import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'
import { processMatchEvents } from '@/lib/playoff-stats'
import type { LiveScore } from '@/lib/live-scores'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'

// Server-side cache to avoid redundant API calls when many users poll simultaneously
let cache: { key: string; data: Record<number, LiveScore>; timestamp: number } | null = null
const CACHE_TTL = 15_000 // 15 seconds

// Map API-Football status codes to our internal numeric codes (matching SofaScore convention)
function mapStatusCode(short: string): number {
  switch (short) {
    case '1H': return 6
    case '2H': return 7
    case 'HT': return 31
    case 'BT': return 32  // Break time (waiting for extra time)
    case 'ET': return 41   // Extra time 1st half
    case '2ET': return 42  // Extra time 2nd half
    case 'EHT': return 33  // Extra time halftime
    case 'P': return 50    // Penalties
    case 'FT': case 'AET': case 'PEN': return 100
    default: return 0
  }
}

function mapStatusType(short: string): string {
  switch (short) {
    case 'NS': case 'TBD': case 'PST': case 'CANC': case 'ABD': case 'WO':
      return 'notstarted'
    case 'FT': case 'AET': case 'PEN':
      return 'finished'
    default:
      return 'inprogress'
  }
}

interface ApiFootballFixture {
  fixture: {
    id: number
    timestamp: number
    periods: { first: number | null; second: number | null }
    status: { long: string; short: string; elapsed: number | null; extra: number | null }
  }
  teams: {
    home: { id: number; name: string; winner: boolean | null }
    away: { id: number; name: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

function parseApiFootballFixture(f: ApiFootballFixture): LiveScore | null {
  try {
    const status = f.fixture.status
    const statusCode = mapStatusCode(status.short)
    const statusType = mapStatusType(status.short)
    const elapsed = status.elapsed ?? 0
    const nowSec = Math.floor(Date.now() / 1000)

    // Synthesize currentPeriodStartTimestamp from elapsed minute so calcMatchMinute() works
    let timeInitial = 0
    let currentPeriodStartTimestamp: number | null = null
    if (statusType === 'inprogress' && statusCode !== 31 && statusCode !== 32 && statusCode !== 33) {
      if (statusCode === 7) {
        // 2nd half: elapsed is e.g. 67, timeInitial is 2700 (45min in seconds)
        timeInitial = 2700
        currentPeriodStartTimestamp = nowSec - ((elapsed - 45) * 60)
      } else if (statusCode === 41) {
        // Extra time 1st half
        timeInitial = 5400
        currentPeriodStartTimestamp = nowSec - ((elapsed - 90) * 60)
      } else if (statusCode === 42) {
        // Extra time 2nd half
        timeInitial = 6300
        currentPeriodStartTimestamp = nowSec - ((elapsed - 105) * 60)
      } else {
        // 1st half
        timeInitial = 0
        currentPeriodStartTimestamp = nowSec - (elapsed * 60)
      }
    }

    // Determine winner code
    let winnerCode: number | null = null
    if (f.teams.home.winner === true) winnerCode = 1
    else if (f.teams.away.winner === true) winnerCode = 2

    return {
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      statusType,
      statusCode,
      statusDescription: status.long || '',
      currentPeriodStartTimestamp,
      startTimestamp: f.fixture.timestamp,
      timeInitial,
      timeMax: timeInitial === 0 ? 2700 : 5400,
      timeExtra: 540,
      // Period scores for cup final 90-min calculation
      homePeriod1: f.score.halftime.home,
      homePeriod2: f.score.fulltime.home !== null && f.score.halftime.home !== null
        ? f.score.fulltime.home - f.score.halftime.home : null,
      awayPeriod1: f.score.halftime.away,
      awayPeriod2: f.score.fulltime.away !== null && f.score.halftime.away !== null
        ? f.score.fulltime.away - f.score.halftime.away : null,
      winnerCode,
      homeTeamName: f.teams.home.name,
      awayTeamName: f.teams.away.name,
    }
  } catch {
    return null
  }
}

// Mock starts when the first request arrives after server start.
// Timeline (5 minutes total, no looping):
//   0:00-1:00  1st half, 0-0 (minute ticks up from 1')
//   1:00-1:30  1st half, 1-0 (goal!)
//   1:30-2:00  Halftime, 1-0
//   2:00-2:30  2nd half, 1-0 (minute ticks from 46')
//   2:30-3:00  2nd half, 1-1 (goal!)
//   3:00-3:30  2nd half, 2-1 (goal!)
//   3:30-4:30  Added time, 2-1 (90+x')
//   4:30+      Finished, 2-1 → auto-save triggers
let mockStartTime: number | null = null

const MOCK_EXTRA_FIELDS = {
  homePeriod1: null, homePeriod2: null, awayPeriod1: null, awayPeriod2: null,
  winnerCode: null, homeTeamName: null, awayTeamName: null,
} as const

function generateMockScore(eventId: number): LiveScore {
  const nowSec = Math.floor(Date.now() / 1000)

  // Start on first request, persists until server restart
  if (mockStartTime === null) {
    mockStartTime = nowSec
  }

  const elapsed = nowSec - mockStartTime
  // Per-event offset (0-10s) so multiple mocked matches aren't perfectly in sync
  const offset = (eventId * 13) % 10
  const e = Math.max(0, elapsed - offset)

  // Kick-off timestamp for minute calculation
  const kickoff = mockStartTime + offset
  const halfTwoStart = kickoff + 120 // 2nd half "starts" at 2:00

  if (e < 60) {
    // 1st half, 0-0
    return {
      homeScore: 0, awayScore: 0,
      statusType: 'inprogress', statusCode: 6, statusDescription: '1st half',
      currentPeriodStartTimestamp: kickoff,
      startTimestamp: kickoff,
      timeInitial: 0, timeMax: 2700, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 90) {
    // 1st half, 1-0
    return {
      homeScore: 1, awayScore: 0,
      statusType: 'inprogress', statusCode: 6, statusDescription: '1st half',
      currentPeriodStartTimestamp: kickoff,
      startTimestamp: kickoff,
      timeInitial: 0, timeMax: 2700, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 120) {
    // Halftime
    return {
      homeScore: 1, awayScore: 0,
      statusType: 'inprogress', statusCode: 31, statusDescription: 'Halftime',
      currentPeriodStartTimestamp: null,
      startTimestamp: kickoff,
      timeInitial: 2700, timeMax: 2700, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 150) {
    // 2nd half, 1-0
    return {
      homeScore: 1, awayScore: 0,
      statusType: 'inprogress', statusCode: 7, statusDescription: '2nd half',
      currentPeriodStartTimestamp: halfTwoStart,
      startTimestamp: kickoff,
      timeInitial: 2700, timeMax: 5400, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 180) {
    // 2nd half, 1-1
    return {
      homeScore: 1, awayScore: 1,
      statusType: 'inprogress', statusCode: 7, statusDescription: '2nd half',
      currentPeriodStartTimestamp: halfTwoStart,
      startTimestamp: kickoff,
      timeInitial: 2700, timeMax: 5400, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 210) {
    // 2nd half, 2-1
    return {
      homeScore: 2, awayScore: 1,
      statusType: 'inprogress', statusCode: 7, statusDescription: '2nd half',
      currentPeriodStartTimestamp: halfTwoStart,
      startTimestamp: kickoff,
      timeInitial: 2700, timeMax: 5400, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else if (e < 270) {
    // Added time, 2-1
    return {
      homeScore: 2, awayScore: 1,
      statusType: 'inprogress', statusCode: 7, statusDescription: '2nd half',
      currentPeriodStartTimestamp: halfTwoStart,
      startTimestamp: kickoff,
      timeInitial: 2700, timeMax: 5400, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  } else {
    // Finished
    return {
      homeScore: 2, awayScore: 1,
      statusType: 'finished', statusCode: 100, statusDescription: 'Ended',
      currentPeriodStartTimestamp: null,
      startTimestamp: kickoff,
      timeInitial: 5400, timeMax: 5400, timeExtra: 540,
      ...MOCK_EXTRA_FIELDS,
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const ids: number[] = body.ids || []
    const isMock = body.mock === true && process.env.NODE_ENV !== 'production'

    if (ids.length === 0 || ids.length > 50) {
      return NextResponse.json({ scores: {}, saved: [] })
    }

    // Fetch scores
    const scores: Record<number, LiveScore> = {}

    if (isMock) {
      // Only mock match 1's fixture ID, ignore all others
      const MOCK_EVENT_ID = 15858608
      if (ids.includes(MOCK_EVENT_ID)) {
        scores[MOCK_EVENT_ID] = generateMockScore(MOCK_EVENT_ID)
      }
    } else {
      // Check cache first
      const cacheKey = ids.sort().join(',')
      const now = Date.now()
      if (cache && cache.key === cacheKey && now - cache.timestamp < CACHE_TTL) {
        Object.assign(scores, cache.data)
      } else {
        // Batch fetch from API-Football (supports comma-separated IDs)
        const idsParam = ids.join('-')
        try {
          const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?ids=${idsParam}`, {
            headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY || '' },
            cache: 'no-store',
          })
          if (!res.ok) {
            console.error(`[live-scores] API-Football returned ${res.status}`)
          } else {
            const data = await res.json()
            for (const fixture of data.response || []) {
              const parsed = parseApiFootballFixture(fixture)
              if (parsed) scores[fixture.fixture.id] = parsed
            }
          }
        } catch (e) {
          console.error('[live-scores] API-Football fetch failed:', e)
        }

        // Update cache
        cache = { key: cacheKey, data: { ...scores }, timestamp: now }
      }
    }

    // Auto-save: check for finished matches (skip in mock mode)
    const saved: number[] = []
    if (isMock) {
      return NextResponse.json(
        { scores, saved },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      )
    }
    const finishedEvents = Object.entries(scores).filter(
      ([, s]) => s.statusType === 'finished' && s.homeScore !== null && s.awayScore !== null
    )

    if (finishedEvents.length > 0) {
      const serviceClient = await createServiceClient()

      // Find which matches have these API-Football fixture IDs
      const eventIds = finishedEvents.map(([id]) => Number(id))
      const { data: matchRows } = await serviceClient
        .from('matches')
        .select('id, api_football_fixture_id, home_team_id, away_team_id, speeldag, is_cup_final')
        .in('api_football_fixture_id', eventIds)

      if (matchRows && matchRows.length > 0) {
        // Check which already have results
        const matchIds = matchRows.map(m => m.id)
        const { data: existingResults } = await serviceClient
          .from('results')
          .select('match_id')
          .in('match_id', matchIds)

        const existingMatchIds = new Set((existingResults || []).map(r => r.match_id))

        let needsRecalc = false
        for (const matchRow of matchRows) {
          if (existingMatchIds.has(matchRow.id)) continue

          const score = scores[matchRow.api_football_fixture_id!]
          if (!score || score.homeScore === null || score.awayScore === null) continue

          // Cup final: use period1 + period2 (90-min score)
          // Regular matches: use current score
          let saveHome = score.homeScore
          let saveAway = score.awayScore
          if (matchRow.is_cup_final && score.homePeriod1 !== null && score.homePeriod2 !== null && score.awayPeriod1 !== null && score.awayPeriod2 !== null) {
            saveHome = score.homePeriod1 + score.homePeriod2
            saveAway = score.awayPeriod1 + score.awayPeriod2
          }

          // Insert result (ON CONFLICT DO NOTHING via upsert)
          const { error } = await serviceClient
            .from('results')
            .upsert(
              {
                match_id: matchRow.id,
                home_score: saveHome,
                away_score: saveAway,
                source: 'auto',
              },
              { onConflict: 'match_id', ignoreDuplicates: true }
            )

          if (!error) {
            saved.push(matchRow.id)
            needsRecalc = true

            // Insert activity event
            const { data: teamRows } = await serviceClient
              .from('teams')
              .select('id, name')
              .in('id', [matchRow.home_team_id, matchRow.away_team_id])

            const teamMap: Record<number, string> = {}
            for (const t of teamRows || []) teamMap[t.id] = t.name

            await serviceClient.from('activity_events').insert({
              type: 'result',
              message: `${teamMap[matchRow.home_team_id] || '?'} ${saveHome} - ${saveAway} ${teamMap[matchRow.away_team_id] || '?'}`,
              metadata: { match_id: matchRow.id, speeldag: matchRow.speeldag, auto_saved: true },
            })

            // League match: process match events (goals, assists, clean sheets)
            if (!matchRow.is_cup_final && matchRow.api_football_fixture_id) {
              await processMatchEvents(
                serviceClient,
                matchRow.id,
                matchRow.api_football_fixture_id,
                matchRow.home_team_id,
                matchRow.away_team_id,
              )
            }

            // Cup final: auto-set bekerwinnaar extra question
            if (matchRow.is_cup_final && score.winnerCode) {
              const winnerName = score.winnerCode === 1 ? score.homeTeamName : score.awayTeamName
              if (winnerName) {
                // Match against DB team names (contains check)
                const dbTeamNames = Object.values(teamMap)
                const winnerDbName = dbTeamNames.find(
                  name => winnerName.toLowerCase().includes(name.toLowerCase())
                ) || winnerName

                // Find bekerwinnaar question and set answer
                const { data: bekerQuestion } = await serviceClient
                  .from('extra_questions')
                  .select('id')
                  .eq('question_key', 'bekerwinnaar')
                  .single()

                if (bekerQuestion) {
                  await serviceClient
                    .from('extra_question_answers')
                    .delete()
                    .eq('question_id', bekerQuestion.id)

                  await serviceClient
                    .from('extra_question_answers')
                    .insert({ question_id: bekerQuestion.id, correct_answer: winnerDbName })
                }
              }
            }
          }
        }

        if (needsRecalc) {
          await recalculateScores(serviceClient)
          revalidatePath('/', 'layout')
        }
      }
    }

    return NextResponse.json(
      { scores, saved },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (err) {
    console.error('[live-scores] Unhandled error:', err)
    return NextResponse.json({ scores: {}, saved: [] })
  }
}
