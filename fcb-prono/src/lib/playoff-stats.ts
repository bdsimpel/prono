import { SupabaseClient } from '@supabase/supabase-js'
import { recalculateScores } from './recalculate'
import { fetchAll } from './supabase/fetch-all'

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io'
const TOTAL_LEAGUE_MATCHES = 30

async function fetchApiFootball(path: string): Promise<Response | null> {
  try {
    const r = await fetch(`${API_FOOTBALL_BASE}${path}`, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY || '' },
      cache: 'no-store',
    })
    if (r.ok) return r
    console.error(`[playoff-stats] API-Football ${path} returned ${r.status}`)
    return null
  } catch (e) {
    console.error(`[playoff-stats] API-Football fetch failed:`, e)
    return null
  }
}

// API-Football full names → DB short names
const TEAM_NAME_MAP: Record<string, string> = {
  'union st. gilloise': 'Union',
  'club brugge kv': 'Club Brugge',
  'st. truiden': 'STVV',
  'gent': 'Gent',
  'kv mechelen': 'Mechelen',
  'anderlecht': 'Anderlecht',
}

function mapApiTeamName(apiName: string): string | null {
  return TEAM_NAME_MAP[apiName.toLowerCase()] ?? null
}

// Match API-Football player name to our football_players DB
function matchPlayerName(
  apiName: string,
  dbPlayers: { id: number; name: string; team: string }[],
  teamName: string
): { id: number; name: string } | null {
  const apiLower = apiName.toLowerCase()

  // Filter to same team first
  const teamPlayers = dbPlayers.filter(p => p.team === teamName)
  const allPlayers = teamPlayers.length > 0 ? teamPlayers : dbPlayers

  // Exact match
  const exact = allPlayers.find(p => p.name.toLowerCase() === apiLower)
  if (exact) return { id: exact.id, name: exact.name }

  // DB name contains API last name
  const apiParts = apiName.split(' ')
  const apiLast = apiParts[apiParts.length - 1].toLowerCase()
  if (apiLast.length >= 3) {
    const lastNameMatch = allPlayers.find(p => p.name.toLowerCase().includes(apiLast))
    if (lastNameMatch) return { id: lastNameMatch.id, name: lastNameMatch.name }
  }

  // API name contains DB name
  const containsMatch = allPlayers.find(p => apiLower.includes(p.name.toLowerCase()))
  if (containsMatch) return { id: containsMatch.id, name: containsMatch.name }

  return null
}

interface MatchGoal {
  playerName: string
  assistName: string | null
  minute: number
  seq: number
  isHome: boolean
  isOwnGoal: boolean
}

async function fetchMatchEvents(fixtureId: number): Promise<MatchGoal[]> {
  try {
    const res = await fetchApiFootball(`/fixtures/events?fixture=${fixtureId}`)
    if (!res) return []
    const data = await res.json()
    const goals = (data.response || []).filter(
      (e: { type: string }) => e.type === 'Goal'
    )
    return goals.map((g: { player?: { name?: string }; assist?: { name?: string | null }; time?: { elapsed?: number }; team?: { name?: string }; detail?: string; comments?: string }, idx: number) => ({
      playerName: g.player?.name || 'Unknown',
      assistName: g.assist?.name || null,
      minute: g.time?.elapsed || 0,
      seq: idx + 1,
      isHome: true, // Will be resolved later via team name matching
      isOwnGoal: g.detail === 'Own Goal',
      _teamName: g.team?.name || '', // Store for team matching
    }))
  } catch {
    return []
  }
}

async function fetchMatchGKs(fixtureId: number): Promise<{ homeGK: string | null; awayGK: string | null; homeTeamName: string; awayTeamName: string }> {
  try {
    const res = await fetchApiFootball(`/fixtures/lineups?fixture=${fixtureId}`)
    if (!res) return { homeGK: null, awayGK: null, homeTeamName: '', awayTeamName: '' }
    const data = await res.json()
    const teams = data.response || []
    if (teams.length < 2) return { homeGK: null, awayGK: null, homeTeamName: '', awayTeamName: '' }

    const findGK = (team: { startXI?: { player?: { pos?: string; name?: string } }[] }) =>
      team.startXI?.find((p: { player?: { pos?: string } }) => p.player?.pos === 'G')?.player?.name || null

    return {
      homeGK: findGK(teams[0]),
      awayGK: findGK(teams[1]),
      homeTeamName: teams[0].team?.name || '',
      awayTeamName: teams[1].team?.name || '',
    }
  } catch {
    return { homeGK: null, awayGK: null, homeTeamName: '', awayTeamName: '' }
  }
}

/**
 * Process a single finished match: fetch events, store goals/assists/clean sheets, check certainty.
 */
export async function processMatchEvents(
  serviceClient: SupabaseClient,
  matchId: number,
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
) {
  // Get team names and football players from DB
  const [{ data: teams }, { data: footballPlayers }] = await Promise.all([
    serviceClient.from('teams').select('id, name').in('id', [homeTeamId, awayTeamId]),
    serviceClient.from('football_players').select('id, name, team'),
  ])

  const teamMap: Record<number, string> = {}
  for (const t of teams || []) teamMap[t.id] = t.name
  const homeTeamName = teamMap[homeTeamId] || ''
  const awayTeamName = teamMap[awayTeamId] || ''

  // Fetch events and lineups from API-Football
  const [goals, gks] = await Promise.all([
    fetchMatchEvents(fixtureId),
    fetchMatchGKs(fixtureId),
  ])

  // Determine team mapping: API-Football home/away vs our DB home/away
  let apiHomeTeamId = homeTeamId
  let apiAwayTeamId = awayTeamId

  // Use lineup team names to determine mapping
  const apiHomeName = gks.homeTeamName
  const apiAwayName = gks.awayTeamName
  if (apiHomeName && apiAwayName) {
    const mappedHome = mapApiTeamName(apiHomeName)
    const mappedAway = mapApiTeamName(apiAwayName)

    // If API home = our away team, swap the mapping
    if (mappedHome === awayTeamName && mappedAway === homeTeamName) {
      apiHomeTeamId = awayTeamId
      apiAwayTeamId = homeTeamId
    }
  }

  const dbPlayers = footballPlayers || []
  const events: {
    match_id: number
    event_type: string
    player_name: string
    football_player_id: number | null
    team_id: number
    minute: number | null
    seq: number
  }[] = []

  for (const goal of goals) {
    if (goal.isOwnGoal) continue // Skip own goals entirely

    // Determine which team scored based on the goal's team name
    const goalObj = goal as MatchGoal & { _teamName?: string }
    const goalTeamName = goalObj._teamName || ''
    const mappedTeam = mapApiTeamName(goalTeamName)
    let scorerTeamId: number
    if (mappedTeam === homeTeamName) {
      scorerTeamId = homeTeamId
    } else if (mappedTeam === awayTeamName) {
      scorerTeamId = awayTeamId
    } else {
      // Fallback: use contains matching
      scorerTeamId = goalTeamName.toLowerCase().includes(homeTeamName.toLowerCase()) ? homeTeamId : awayTeamId
    }
    const scorerTeamDbName = teamMap[scorerTeamId] || ''

    const playerMatch = matchPlayerName(goal.playerName, dbPlayers, scorerTeamDbName)
    events.push({
      match_id: matchId,
      event_type: 'goal',
      player_name: playerMatch?.name ?? goal.playerName,
      football_player_id: playerMatch?.id ?? null,
      team_id: scorerTeamId,
      minute: goal.minute || null,
      seq: goal.seq,
    })

    if (goal.assistName) {
      const assistMatch = matchPlayerName(goal.assistName, dbPlayers, scorerTeamDbName)
      events.push({
        match_id: matchId,
        event_type: 'assist',
        player_name: assistMatch?.name ?? goal.assistName,
        football_player_id: assistMatch?.id ?? null,
        team_id: scorerTeamId,
        minute: goal.minute || null,
        seq: goal.seq,
      })
    }
  }

  // Clean sheets: use the DB result to check who conceded 0
  const { data: result } = await serviceClient
    .from('results')
    .select('home_score, away_score')
    .eq('match_id', matchId)
    .single()

  if (result) {
    // apiHomeTeam conceded = goals scored against them
    const apiHomeConceded = apiHomeTeamId === homeTeamId ? result.away_score : result.home_score
    const apiAwayConceded = apiAwayTeamId === homeTeamId ? result.away_score : result.home_score

    if (apiHomeConceded === 0 && gks.homeGK) {
      const gkTeamName = teamMap[apiHomeTeamId] || ''
      const gkMatch = matchPlayerName(gks.homeGK, dbPlayers, gkTeamName)
      events.push({
        match_id: matchId,
        event_type: 'clean_sheet',
        player_name: gkMatch?.name ?? gks.homeGK,
        football_player_id: gkMatch?.id ?? null,
        team_id: apiHomeTeamId,
        minute: null,
        seq: 0,
      })
    }

    if (apiAwayConceded === 0 && gks.awayGK) {
      const gkTeamName = teamMap[apiAwayTeamId] || ''
      const gkMatch = matchPlayerName(gks.awayGK, dbPlayers, gkTeamName)
      events.push({
        match_id: matchId,
        event_type: 'clean_sheet',
        player_name: gkMatch?.name ?? gks.awayGK,
        football_player_id: gkMatch?.id ?? null,
        team_id: apiAwayTeamId,
        minute: null,
        seq: 0,
      })
    }
  }

  // Insert events (ON CONFLICT DO NOTHING)
  if (events.length > 0) {
    await serviceClient
      .from('match_events')
      .upsert(events, { onConflict: 'match_id,event_type,player_name,seq', ignoreDuplicates: true })
  }

  // Check certainty and update extra question answers
  await checkAndUpdateExtraAnswers(serviceClient)
}

/**
 * Check certainty for all extra questions and update answers when certain.
 */
async function checkAndUpdateExtraAnswers(serviceClient: SupabaseClient) {
  // Get current state
  const [
    { data: allMatches },
    { data: allResults },
    { data: allTeams },
    { data: allQuestions },
    allEvents,
    { data: allFootballPlayers },
  ] = await Promise.all([
    serviceClient.from('matches').select('id, home_team_id, away_team_id, is_cup_final').eq('is_cup_final', false),
    serviceClient.from('results').select('match_id, home_score, away_score'),
    serviceClient.from('teams').select('id, name, standing_rank, points_half'),
    serviceClient.from('extra_questions').select('id, question_key'),
    fetchAll<{ event_type: string; player_name: string; football_player_id: number | null; team_id: number }>(serviceClient, 'match_events', 'event_type, player_name, football_player_id, team_id'),
    serviceClient.from('football_players').select('id, name'),
  ])

  const matches = allMatches || []
  const results = allResults || []
  const teams = allTeams || []
  const questions = allQuestions || []
  const events = allEvents

  const resultMap: Record<number, { home_score: number; away_score: number }> = {}
  for (const r of results) resultMap[r.match_id] = { home_score: r.home_score, away_score: r.away_score }

  // Map football_player_id → DB name (what players chose in meedoen form)
  const footballPlayerNameMap: Record<number, string> = {}
  for (const fp of allFootballPlayers || []) footballPlayerNameMap[fp.id] = fp.name

  const leagueMatches = matches.filter(m => !m.is_cup_final)
  const finishedLeagueMatches = leagueMatches.filter(m => resultMap[m.id])
  const remainingMatches = TOTAL_LEAGUE_MATCHES - finishedLeagueMatches.length
  const allMatchesPlayed = remainingMatches === 0

  // Compute team stats from results
  const teamStats: Record<number, { points: number; goalsFor: number; goalsAgainst: number; played: number; remainingMatches: number }> = {}
  for (const t of teams) {
    teamStats[t.id] = { points: 0, goalsFor: 0, goalsAgainst: 0, played: 0, remainingMatches: 0 }
  }

  for (const m of leagueMatches) {
    const r = resultMap[m.id]
    if (!r) {
      // Remaining match: count for both teams
      if (teamStats[m.home_team_id]) teamStats[m.home_team_id].remainingMatches++
      if (teamStats[m.away_team_id]) teamStats[m.away_team_id].remainingMatches++
      continue
    }

    if (teamStats[m.home_team_id]) {
      teamStats[m.home_team_id].played++
      teamStats[m.home_team_id].goalsFor += r.home_score
      teamStats[m.home_team_id].goalsAgainst += r.away_score
      if (r.home_score > r.away_score) teamStats[m.home_team_id].points += 3
      else if (r.home_score === r.away_score) teamStats[m.home_team_id].points += 1
    }
    if (teamStats[m.away_team_id]) {
      teamStats[m.away_team_id].played++
      teamStats[m.away_team_id].goalsFor += r.away_score
      teamStats[m.away_team_id].goalsAgainst += r.home_score
      if (r.away_score > r.home_score) teamStats[m.away_team_id].points += 3
      else if (r.home_score === r.away_score) teamStats[m.away_team_id].points += 1
    }
  }

  // Aggregate player stats from match_events
  // Use the football_players DB name (what players chose) as the key, falling back to API name
  const playerGoals: Record<string, number> = {}
  const playerAssists: Record<string, number> = {}
  const playerCleanSheets: Record<string, number> = {}

  for (const e of events) {
    const key = (e.football_player_id && footballPlayerNameMap[e.football_player_id]) || e.player_name
    if (e.event_type === 'goal') playerGoals[key] = (playerGoals[key] || 0) + 1
    if (e.event_type === 'assist') playerAssists[key] = (playerAssists[key] || 0) + 1
    if (e.event_type === 'clean_sheet') playerCleanSheets[key] = (playerCleanSheets[key] || 0) + 1
  }

  const teamNameMap: Record<number, string> = {}
  const teamIdByName: Record<string, number> = {}
  for (const t of teams) {
    teamNameMap[t.id] = t.name
    teamIdByName[t.name] = t.id
  }

  const questionMap: Record<string, number> = {}
  for (const q of questions) questionMap[q.question_key] = q.id

  // Helper to set answer(s) for a question
  async function setAnswers(questionKey: string, answers: string[]) {
    const qId = questionMap[questionKey]
    if (!qId || answers.length === 0) return

    await serviceClient.from('extra_question_answers').delete().eq('question_id', qId)
    const rows = answers.map(a => ({ question_id: qId, correct_answer: a }))
    await serviceClient.from('extra_question_answers').upsert(rows, { onConflict: 'question_id,correct_answer', ignoreDuplicates: true })
  }

  // === TOPSCORER (only after all matches) ===
  if (allMatchesPlayed && Object.keys(playerGoals).length > 0) {
    const maxGoals = Math.max(...Object.values(playerGoals))
    const topScorers = Object.entries(playerGoals).filter(([, g]) => g === maxGoals).map(([name]) => name)
    await setAnswers('topscorer_poi', topScorers)
  }

  // === ASSISTENKONING (only after all matches) ===
  if (allMatchesPlayed && Object.keys(playerAssists).length > 0) {
    const maxAssists = Math.max(...Object.values(playerAssists))
    const topAssisters = Object.entries(playerAssists).filter(([, a]) => a === maxAssists).map(([name]) => name)
    await setAnswers('assistenkoning_poi', topAssisters)
  }

  // === MEESTE CLEAN SHEETS (can be set early) ===
  if (Object.keys(playerCleanSheets).length > 0) {
    const maxCS = Math.max(...Object.values(playerCleanSheets))
    // Check if leader is certain: leader's CS >= runner-up's CS + runner-up's remaining matches
    const gkTeams: Record<string, number> = {}
    for (const e of events) {
      if (e.event_type === 'clean_sheet') {
        const key = (e.football_player_id && footballPlayerNameMap[e.football_player_id]) || e.player_name
        gkTeams[key] = e.team_id
      }
    }

    let leaderIsCertain = allMatchesPlayed
    if (!leaderIsCertain) {
      // Check if ANY team's GK (even ones with 0 clean sheets) could catch up
      let anyCanCatchUp = false
      for (const t of teams) {
        const teamRemaining = teamStats[t.id]?.remainingMatches ?? 0
        // Find this team's known GK clean sheets (if any)
        const teamGK = Object.entries(gkTeams).find(([, tid]) => tid === t.id)?.[0]
        const currentCS = teamGK ? (playerCleanSheets[teamGK] || 0) : 0
        if (currentCS === maxCS) continue // already a leader
        if (currentCS + teamRemaining >= maxCS) {
          anyCanCatchUp = true
          break
        }
      }

      leaderIsCertain = !anyCanCatchUp
    }

    if (leaderIsCertain) {
      const topCS = Object.entries(playerCleanSheets).filter(([, cs]) => cs === maxCS).map(([name]) => name)
      await setAnswers('meeste_clean_sheets_poi', topCS)
    }
  }

  // === BESTE PLOEG (can be set early) ===
  {
    const teamPoints = teams.map(t => ({ id: t.id, name: t.name, points: teamStats[t.id]?.points ?? 0, remaining: teamStats[t.id]?.remainingMatches ?? 0 }))
    const maxPoints = Math.max(...teamPoints.map(t => t.points))
    const leaders = teamPoints.filter(t => t.points === maxPoints)

    let certain = true
    for (const t of teamPoints) {
      if (t.points === maxPoints) continue
      if (t.points + t.remaining * 3 >= maxPoints) {
        certain = false
        break
      }
    }

    if (certain && leaders.length > 0) {
      await setAnswers('beste_ploeg_poi', leaders.map(t => t.name))
    }
  }

  // === MEESTE GOALS (only after all matches) ===
  if (allMatchesPlayed) {
    const teamGoals = teams.map(t => ({ name: t.name, goals: teamStats[t.id]?.goalsFor ?? 0 }))
    const maxGoals = Math.max(...teamGoals.map(t => t.goals))
    const topTeams = teamGoals.filter(t => t.goals === maxGoals).map(t => t.name)
    await setAnswers('meeste_goals_poi', topTeams)
  }

  // === MINSTE GOALS TEGEN (only after all matches) ===
  if (allMatchesPlayed) {
    const teamGA = teams.map(t => ({ name: t.name, ga: teamStats[t.id]?.goalsAgainst ?? 0 }))
    const minGA = Math.min(...teamGA.map(t => t.ga))
    const topTeams = teamGA.filter(t => t.ga === minGA).map(t => t.name)
    await setAnswers('minste_goals_tegen_poi', topTeams)
  }

  // === KAMPIOEN (when mathematically certain) ===
  {
    const teamTotals = teams.map(t => ({
      id: t.id,
      name: t.name,
      standingRank: t.standing_rank ?? 99,
      totalPoints: (Number(t.points_half) || 0) + (teamStats[t.id]?.points ?? 0),
      maxPossible: (Number(t.points_half) || 0) + (teamStats[t.id]?.points ?? 0) + (teamStats[t.id]?.remainingMatches ?? 0) * 3,
    }))

    teamTotals.sort((a, b) => b.totalPoints - a.totalPoints || a.standingRank - b.standingRank)

    const leader = teamTotals[0]
    if (leader) {
      let isCertain = true
      for (let i = 1; i < teamTotals.length; i++) {
        const other = teamTotals[i]
        if (other.maxPossible > leader.totalPoints) {
          isCertain = false
          break
        }
        if (other.maxPossible === leader.totalPoints && other.standingRank < leader.standingRank) {
          isCertain = false
          break
        }
      }

      if (isCertain) {
        await setAnswers('kampioen', [leader.name])
      }
    }
  }
}

/**
 * Resync all match events from scratch for all finished league matches.
 */
export async function resyncAllMatchEvents(serviceClient: SupabaseClient) {
  const { data: matches } = await serviceClient
    .from('matches')
    .select('id, home_team_id, away_team_id, api_football_fixture_id, is_cup_final')
    .eq('is_cup_final', false)
    .not('api_football_fixture_id', 'is', null)

  const { data: results } = await serviceClient
    .from('results')
    .select('match_id')

  const resultMatchIds = new Set((results || []).map(r => r.match_id))
  const finishedMatches = (matches || []).filter(m => resultMatchIds.has(m.id))

  for (const match of finishedMatches) {
    await processMatchEvents(
      serviceClient,
      match.id,
      match.api_football_fixture_id!,
      match.home_team_id,
      match.away_team_id,
    )
  }

  // Recalculate player scores after updating answers
  await recalculateScores(serviceClient)
}
