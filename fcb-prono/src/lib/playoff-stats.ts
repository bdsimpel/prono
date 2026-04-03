import { SupabaseClient } from '@supabase/supabase-js'
import { recalculateScores } from './recalculate'
import { fetchAll } from './supabase/fetch-all'

const SOFASCORE_URL = 'https://www.sofascore.com/api/v1/event'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const TOTAL_LEAGUE_MATCHES = 30

// SofaScore full names → DB short names
const TEAM_NAME_MAP: Record<string, string> = {
  'royale union saint-gilloise': 'Union',
  'club brugge kv': 'Club Brugge',
  'sint-truidense vv': 'STVV',
  'kaa gent': 'Gent',
  'kv mechelen': 'Mechelen',
  'rsc anderlecht': 'Anderlecht',
}

function mapSofascoreTeamName(sofaName: string): string | null {
  return TEAM_NAME_MAP[sofaName.toLowerCase()] ?? null
}

// Match SofaScore player name to our football_players DB
function matchPlayerName(
  sofaName: string,
  dbPlayers: { id: number; name: string; team: string }[],
  teamName: string
): { id: number; name: string } | null {
  const sofaLower = sofaName.toLowerCase()

  // Filter to same team first
  const teamPlayers = dbPlayers.filter(p => p.team === teamName)
  const allPlayers = teamPlayers.length > 0 ? teamPlayers : dbPlayers

  // Exact match
  const exact = allPlayers.find(p => p.name.toLowerCase() === sofaLower)
  if (exact) return { id: exact.id, name: exact.name }

  // DB name contains SofaScore last name
  const sofaParts = sofaName.split(' ')
  const sofaLast = sofaParts[sofaParts.length - 1].toLowerCase()
  if (sofaLast.length >= 3) {
    const lastNameMatch = allPlayers.find(p => p.name.toLowerCase().includes(sofaLast))
    if (lastNameMatch) return { id: lastNameMatch.id, name: lastNameMatch.name }
  }

  // SofaScore name contains DB name
  const containsMatch = allPlayers.find(p => sofaLower.includes(p.name.toLowerCase()))
  if (containsMatch) return { id: containsMatch.id, name: containsMatch.name }

  return null
}

interface SofascoreGoal {
  playerName: string
  assistName: string | null
  minute: number
  isHome: boolean
  isOwnGoal: boolean
}

async function fetchMatchIncidents(eventId: number): Promise<SofascoreGoal[]> {
  try {
    const res = await fetch(`${SOFASCORE_URL}/${eventId}/incidents`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const data = await res.json()
    const goals = (data.incidents || []).filter(
      (i: { incidentType: string }) => i.incidentType === 'goal'
    )
    return goals.map((g: { player?: { name?: string }; assist1?: { name?: string }; time?: number; isHome?: boolean; incidentClass?: string }) => ({
      playerName: g.player?.name || 'Unknown',
      assistName: g.assist1?.name || null,
      minute: g.time || 0,
      isHome: g.isHome ?? true,
      isOwnGoal: g.incidentClass === 'ownGoal',
    }))
  } catch {
    return []
  }
}

async function fetchMatchGKs(eventId: number): Promise<{ homeGK: string | null; awayGK: string | null }> {
  try {
    const res = await fetch(`${SOFASCORE_URL}/${eventId}/lineups`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const data = await res.json()
    const homeGK = data.home?.players?.find(
      (p: { player?: { position?: string } }) => p.player?.position === 'G'
    )
    const awayGK = data.away?.players?.find(
      (p: { player?: { position?: string } }) => p.player?.position === 'G'
    )
    return {
      homeGK: homeGK?.player?.name || null,
      awayGK: awayGK?.player?.name || null,
    }
  } catch {
    return { homeGK: null, awayGK: null }
  }
}

/**
 * Process a single finished match: fetch incidents, store events, check certainty.
 */
export async function processMatchEvents(
  serviceClient: SupabaseClient,
  matchId: number,
  sofascoreEventId: number,
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

  // Fetch incidents and lineups from SofaScore
  const [goals, gks] = await Promise.all([
    fetchMatchIncidents(sofascoreEventId),
    fetchMatchGKs(sofascoreEventId),
  ])

  // Determine which SofaScore side maps to which DB team
  // We know our match has homeTeamId and awayTeamId
  // SofaScore's isHome refers to their home team
  // We need to figure out the mapping - use the match's sofascore event to check team names
  // For simplicity: fetch the event to get SofaScore team names and map them
  let sofaHomeTeamId = homeTeamId
  let sofaAwayTeamId = awayTeamId
  try {
    const eventRes = await fetch(`${SOFASCORE_URL}/${sofascoreEventId}`, {
      headers: { 'User-Agent': USER_AGENT },
    })
    const eventData = await eventRes.json()
    const sofaHomeName = eventData.event?.homeTeam?.name || ''
    const sofaAwayName = eventData.event?.awayTeam?.name || ''
    const mappedHome = mapSofascoreTeamName(sofaHomeName)
    const mappedAway = mapSofascoreTeamName(sofaAwayName)

    // If SofaScore home = our away team, swap the mapping
    if (mappedHome === awayTeamName && mappedAway === homeTeamName) {
      sofaHomeTeamId = awayTeamId
      sofaAwayTeamId = homeTeamId
    }
  } catch {
    // Fall back to assuming same order
  }

  const dbPlayers = footballPlayers || []
  const events: {
    match_id: number
    event_type: string
    player_name: string
    football_player_id: number | null
    team_id: number
    minute: number | null
  }[] = []

  for (const goal of goals) {
    if (goal.isOwnGoal) continue // Skip own goals entirely

    const scorerTeamId = goal.isHome ? sofaHomeTeamId : sofaAwayTeamId
    const scorerTeamName = teamMap[scorerTeamId] || ''

    const playerMatch = matchPlayerName(goal.playerName, dbPlayers, scorerTeamName)
    events.push({
      match_id: matchId,
      event_type: 'goal',
      player_name: goal.playerName,
      football_player_id: playerMatch?.id ?? null,
      team_id: scorerTeamId,
      minute: goal.minute || null,
    })

    if (goal.assistName) {
      const assistMatch = matchPlayerName(goal.assistName, dbPlayers, scorerTeamName)
      events.push({
        match_id: matchId,
        event_type: 'assist',
        player_name: goal.assistName,
        football_player_id: assistMatch?.id ?? null,
        team_id: scorerTeamId,
        minute: goal.minute || null,
      })
    }
  }

  // Clean sheets: use the DB result to check who conceded 0
  // SofaScore homeGK plays for sofaHomeTeamId, awayGK for sofaAwayTeamId
  const { data: result } = await serviceClient
    .from('results')
    .select('home_score, away_score')
    .eq('match_id', matchId)
    .single()

  if (result) {
    // Goals conceded by each SofaScore side:
    // sofaHomeTeam conceded = goals scored against them
    // If sofaHomeTeamId === homeTeamId (DB), then sofaHome conceded result.away_score
    // If sofaHomeTeamId === awayTeamId (DB, swapped), then sofaHome conceded result.home_score
    const sofaHomeConceded = sofaHomeTeamId === homeTeamId ? result.away_score : result.home_score
    const sofaAwayConceded = sofaAwayTeamId === homeTeamId ? result.away_score : result.home_score

    if (sofaHomeConceded === 0 && gks.homeGK) {
      const gkTeamName = teamMap[sofaHomeTeamId] || ''
      const gkMatch = matchPlayerName(gks.homeGK, dbPlayers, gkTeamName)
      events.push({
        match_id: matchId,
        event_type: 'clean_sheet',
        player_name: gks.homeGK,
        football_player_id: gkMatch?.id ?? null,
        team_id: sofaHomeTeamId,
        minute: null,
      })
    }

    if (sofaAwayConceded === 0 && gks.awayGK) {
      const gkTeamName = teamMap[sofaAwayTeamId] || ''
      const gkMatch = matchPlayerName(gks.awayGK, dbPlayers, gkTeamName)
      events.push({
        match_id: matchId,
        event_type: 'clean_sheet',
        player_name: gks.awayGK,
        football_player_id: gkMatch?.id ?? null,
        team_id: sofaAwayTeamId,
        minute: null,
      })
    }
  }

  // Insert events (ON CONFLICT DO NOTHING)
  if (events.length > 0) {
    await serviceClient
      .from('match_events')
      .upsert(events, { onConflict: 'match_id,event_type,player_name,minute', ignoreDuplicates: true })
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
  // Use the football_players DB name (what players chose) as the key, falling back to SofaScore name
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
    // Find runner-up's max possible
    // Each GK's team has a number of remaining matches
    const gkTeams: Record<string, number> = {} // resolved name → team_id
    for (const e of events) {
      if (e.event_type === 'clean_sheet') {
        const key = (e.football_player_id && footballPlayerNameMap[e.football_player_id]) || e.player_name
        gkTeams[key] = e.team_id
      }
    }

    let leaderIsCertain = allMatchesPlayed
    if (!leaderIsCertain) {
      const leaders = Object.entries(playerCleanSheets).filter(([, cs]) => cs === maxCS)
      // Check if any non-leader can catch up
      const allGKs = new Set([...Object.keys(playerCleanSheets), ...Object.keys(gkTeams)])
      let anyCanCatchUp = false

      for (const gk of allGKs) {
        const currentCS = playerCleanSheets[gk] || 0
        if (currentCS === maxCS) continue // is a leader
        const gkTeamId = gkTeams[gk]
        const remaining = gkTeamId ? (teamStats[gkTeamId]?.remainingMatches ?? 0) : remainingMatches
        if (currentCS + remaining >= maxCS) {
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

    // Check if leaders are certain: their points >= all others' max possible
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
        // Tie possible: check tiebreaker (lower standing_rank wins)
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
    .select('id, home_team_id, away_team_id, sofascore_event_id, is_cup_final')
    .eq('is_cup_final', false)
    .not('sofascore_event_id', 'is', null)

  const { data: results } = await serviceClient
    .from('results')
    .select('match_id')

  const resultMatchIds = new Set((results || []).map(r => r.match_id))
  const finishedMatches = (matches || []).filter(m => resultMatchIds.has(m.id))

  for (const match of finishedMatches) {
    await processMatchEvents(
      serviceClient,
      match.id,
      match.sofascore_event_id!,
      match.home_team_id,
      match.away_team_id,
    )
  }

  // Recalculate player scores after updating answers
  await recalculateScores(serviceClient)
}
