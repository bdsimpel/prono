import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
const JPL_LEAGUE_ID = 144
const CUP_LEAGUE_ID = 147
const SEASON = 2025

// API-Football team names → DB short names
const TEAM_NAME_MAP: Record<string, string> = {
  'union st. gilloise': 'Union',
  'club brugge kv': 'Club Brugge',
  'st. truiden': 'STVV',
  'gent': 'Gent',
  'kv mechelen': 'Mechelen',
  'anderlecht': 'Anderlecht',
}

function mapTeamName(apiName: string): string | null {
  const lower = apiName.toLowerCase()
  if (TEAM_NAME_MAP[lower]) return TEAM_NAME_MAP[lower]
  // Fallback: check if DB name is contained in API name
  for (const [, dbName] of Object.entries(TEAM_NAME_MAP)) {
    if (lower.includes(dbName.toLowerCase())) return dbName
  }
  return null
}

export async function POST() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = await createServiceClient()

  // Fetch all matches from DB
  const { data: dbMatches } = await serviceClient
    .from('matches')
    .select('id, home_team_id, away_team_id, match_datetime, is_cup_final')

  if (!dbMatches || dbMatches.length === 0) {
    return NextResponse.json({ error: 'No matches in DB' }, { status: 400 })
  }

  // Get team names
  const teamIds = [...new Set(dbMatches.flatMap(m => [m.home_team_id, m.away_team_id]))]
  const { data: teams } = await serviceClient
    .from('teams')
    .select('id, name')
    .in('id', teamIds)

  const teamNameById: Record<number, string> = {}
  for (const t of teams || []) teamNameById[t.id] = t.name

  // Fetch fixtures from API-Football (JPL league + Cup)
  const apiKey = process.env.API_FOOTBALL_KEY || ''
  const headers = { 'x-apisports-key': apiKey }

  const [jplRes, cupRes] = await Promise.all([
    fetch(`${API_FOOTBALL_BASE}/fixtures?league=${JPL_LEAGUE_ID}&season=${SEASON}`, { headers, cache: 'no-store' }),
    fetch(`${API_FOOTBALL_BASE}/fixtures?league=${CUP_LEAGUE_ID}&season=${SEASON}`, { headers, cache: 'no-store' }),
  ])

  const jplData = jplRes.ok ? await jplRes.json() : { response: [] }
  const cupData = cupRes.ok ? await cupRes.json() : { response: [] }

  // Only include the cup final
  const cupFinalFixtures = (cupData.response || []).filter(
    (f: { league: { round: string } }) => f.league.round === 'Final'
  )
  const allFixtures = [...(jplData.response || []), ...cupFinalFixtures]

  // Match API fixtures to DB matches
  const matched: { matchId: number; fixtureId: number; label: string }[] = []
  const unmatched: { fixtureId: number; home: string; away: string; date: string }[] = []

  for (const fixture of allFixtures) {
    const apiHome = fixture.teams?.home?.name || ''
    const apiAway = fixture.teams?.away?.name || ''
    const fixtureId = fixture.fixture?.id
    const fixtureDate = fixture.fixture?.date ? new Date(fixture.fixture.date) : null

    const dbHome = mapTeamName(apiHome)
    const dbAway = mapTeamName(apiAway)

    if (!dbHome || !dbAway) {
      unmatched.push({ fixtureId, home: apiHome, away: apiAway, date: fixtureDate?.toISOString() || '' })
      continue
    }

    // Find matching DB match by team names + date (same day)
    const match = dbMatches.find(m => {
      const mHome = teamNameById[m.home_team_id]
      const mAway = teamNameById[m.away_team_id]
      if (!mHome || !mAway) return false

      // Check teams match (either order since API-Football might swap home/away)
      const teamsMatch = (mHome === dbHome && mAway === dbAway) || (mHome === dbAway && mAway === dbHome)
      if (!teamsMatch) return false

      // Check date matches (same day)
      if (m.match_datetime && fixtureDate) {
        const dbDate = new Date(m.match_datetime)
        return dbDate.toDateString() === fixtureDate.toDateString()
      }

      return true
    })

    if (match) {
      matched.push({ matchId: match.id, fixtureId, label: `${dbHome} vs ${dbAway}` })
    } else {
      unmatched.push({ fixtureId, home: apiHome, away: apiAway, date: fixtureDate?.toISOString() || '' })
    }
  }

  // Update DB with matched fixture IDs
  for (const m of matched) {
    await serviceClient
      .from('matches')
      .update({ api_football_fixture_id: m.fixtureId })
      .eq('id', m.matchId)
  }

  return NextResponse.json({
    matched: matched.length,
    unmatched: unmatched.length,
    details: { matched, unmatched: unmatched.slice(0, 20) },
  })
}
