export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'
import { processMatchEvents } from '@/lib/playoff-stats'
import type { LiveScore } from '@/lib/live-scores'

const SOFASCORE_URL = 'https://www.sofascore.com/api/v1/event'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseSofascoreEvent(event: Record<string, unknown>): LiveScore | null {
  try {
    const status = event.status as { code: number; description: string; type: string } | undefined
    const homeScore = event.homeScore as { current?: number; period1?: number; period2?: number } | undefined
    const awayScore = event.awayScore as { current?: number; period1?: number; period2?: number } | undefined
    const time = event.time as { initial?: number; max?: number; extra?: number; currentPeriodStartTimestamp?: number } | undefined
    const homeTeam = event.homeTeam as { name?: string } | undefined
    const awayTeam = event.awayTeam as { name?: string } | undefined

    if (!status) return null

    return {
      homeScore: homeScore?.current ?? null,
      awayScore: awayScore?.current ?? null,
      statusType: status.type || 'notstarted',
      statusCode: status.code || 0,
      statusDescription: status.description || '',
      currentPeriodStartTimestamp: (event.currentPeriodStartTimestamp as number) ?? time?.currentPeriodStartTimestamp ?? null,
      startTimestamp: (event.startTimestamp as number) ?? null,
      timeInitial: time?.initial ?? 0,
      timeMax: time?.max ?? 2700,
      timeExtra: time?.extra ?? 540,
      homePeriod1: homeScore?.period1 ?? null,
      homePeriod2: homeScore?.period2 ?? null,
      awayPeriod1: awayScore?.period1 ?? null,
      awayPeriod2: awayScore?.period2 ?? null,
      winnerCode: (event.winnerCode as number) ?? null,
      homeTeamName: homeTeam?.name ?? null,
      awayTeamName: awayTeam?.name ?? null,
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
      // Only mock match 1's sofascore ID, ignore all others
      const MOCK_EVENT_ID = 15858608
      if (ids.includes(MOCK_EVENT_ID)) {
        scores[MOCK_EVENT_ID] = generateMockScore(MOCK_EVENT_ID)
      }
    } else {
      const results = await Promise.allSettled(
        ids.map(id =>
          fetch(`${SOFASCORE_URL}/${id}`, {
            headers: { 'User-Agent': USER_AGENT },
            next: { revalidate: 15 },
          }).then(r => r.json())
        )
      )

      for (let i = 0; i < ids.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled' && r.value?.event) {
          const parsed = parseSofascoreEvent(r.value.event)
          if (parsed) scores[ids[i]] = parsed
        }
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

      // Find which matches have these sofascore event IDs
      const eventIds = finishedEvents.map(([id]) => Number(id))
      const { data: matchRows } = await serviceClient
        .from('matches')
        .select('id, sofascore_event_id, home_team_id, away_team_id, speeldag, is_cup_final')
        .in('sofascore_event_id', eventIds)

      if (matchRows && matchRows.length > 0) {
        // Check which already have results
        const matchIds = matchRows.map(m => m.id)
        // Check which already have results
        const { data: existingResults } = await serviceClient
          .from('results')
          .select('match_id')
          .in('match_id', matchIds)

        const existingMatchIds = new Set((existingResults || []).map(r => r.match_id))

        let needsRecalc = false
        for (const matchRow of matchRows) {
          if (existingMatchIds.has(matchRow.id)) continue

          const score = scores[matchRow.sofascore_event_id!]
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
            if (!matchRow.is_cup_final && matchRow.sofascore_event_id) {
              await processMatchEvents(
                serviceClient,
                matchRow.id,
                matchRow.sofascore_event_id,
                matchRow.home_team_id,
                matchRow.away_team_id,
              )
            }

            // Cup final: auto-set bekerwinnaar extra question
            if (matchRow.is_cup_final && score.winnerCode) {
              // Determine winner name from SofaScore
              const sofaWinnerName = score.winnerCode === 1 ? score.homeTeamName : score.awayTeamName
              if (sofaWinnerName) {
                // Match against DB team names (contains check - SofaScore uses full names like "RSC Anderlecht", DB has "Anderlecht")
                const dbTeamNames = Object.values(teamMap)
                const winnerDbName = dbTeamNames.find(
                  name => sofaWinnerName.toLowerCase().includes(name.toLowerCase())
                ) || sofaWinnerName

                // Find bekerwinnaar question and set answer
                const { data: bekerQuestion } = await serviceClient
                  .from('extra_questions')
                  .select('id')
                  .eq('question_key', 'bekerwinnaar')
                  .single()

                if (bekerQuestion) {
                  // Delete existing answers and insert the winner
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
  } catch {
    return NextResponse.json({ scores: {}, saved: [] })
  }
}
