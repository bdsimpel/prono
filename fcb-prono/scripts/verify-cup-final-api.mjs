// Verify what the live-scores parser would extract for the bekerfinale and a
// past Belgian Cup match that went to extra time. Run with API_FOOTBALL_KEY in
// the env (or sourced from .env.local):
//
//   node --env-file=.env.local scripts/verify-cup-final-api.mjs

const KEY = process.env.API_FOOTBALL_KEY
if (!KEY) {
  console.error('API_FOOTBALL_KEY not set')
  process.exit(1)
}

const BASE = 'https://v3.football.api-sports.io'

// DB orientation for the bekerfinale (per migration-2026-playoffs.sql:78-79):
// home = Anderlecht (id 4), away = Union (id 1). The API has them flipped.
const DB_BEKER_HOME = 'Anderlecht'
const DB_BEKER_AWAY = 'Union'

async function getFixture(id) {
  const res = await fetch(`${BASE}/fixtures?id=${id}`, {
    headers: { 'x-apisports-key': KEY },
  })
  const d = await res.json()
  return d.response?.[0] ?? null
}

function parseFulltime(f) {
  return {
    status: f.fixture.status.short,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    goals: f.goals,
    halftime: f.score.halftime,
    fulltime: f.score.fulltime,
    extratime: f.score.extratime,
    penalty: f.score.penalty,
  }
}

function applyOrientation(parsed, dbHome, dbAway) {
  const apiHomeLc = (parsed.homeTeam || '').toLowerCase()
  const dbHomeLc = dbHome.toLowerCase()
  const dbAwayLc = dbAway.toLowerCase()
  const matchesHome = apiHomeLc.includes(dbHomeLc) || dbHomeLc.includes(apiHomeLc)
  const matchesAway = apiHomeLc.includes(dbAwayLc) || dbAwayLc.includes(apiHomeLc)
  const flipped = matchesAway && !matchesHome

  // Cup final: prefer fulltime (90-min score) over goals (incl. ET)
  const ft = parsed.fulltime
  const useFulltime = ft.home !== null && ft.away !== null
  const apiHome = useFulltime ? ft.home : parsed.goals.home
  const apiAway = useFulltime ? ft.away : parsed.goals.away
  return {
    flipped,
    saveHome: flipped ? apiAway : apiHome,
    saveAway: flipped ? apiHome : apiAway,
    source: useFulltime ? 'fulltime (90 min)' : 'goals (live/final)',
  }
}

console.log('=== Bekerfinale 2025-26 (real fixture) ===')
const beker = await getFixture(1522577)
if (!beker) {
  console.log('No fixture returned.')
} else {
  const parsed = parseFulltime(beker)
  console.log(parsed)
  const o = applyOrientation(parsed, DB_BEKER_HOME, DB_BEKER_AWAY)
  console.log(`→ flipped: ${o.flipped}; would save (DB orientation): ${DB_BEKER_HOME} ${o.saveHome ?? '?'} - ${o.saveAway ?? '?'} ${DB_BEKER_AWAY} (source: ${o.source})`)
}

console.log('\n=== Past AET-with-goals example: Belgian Cup, season 2020 ===')
// Find a past AET match to confirm fulltime is populated correctly when the
// match went to extra time. We look it up live to avoid hardcoding a fixture id
// that might churn.
const cup2020 = await fetch(`${BASE}/fixtures?league=147&season=2020`, {
  headers: { 'x-apisports-key': KEY },
}).then(r => r.json())
const aetWithGoals = (cup2020.response || []).find(f => {
  if (f.fixture.status.short !== 'AET') return false
  return (f.goals.home || 0) + (f.goals.away || 0) > 0
})
if (!aetWithGoals) {
  console.log('No AET-with-goals match found in season 2020.')
} else {
  const parsed = parseFulltime(aetWithGoals)
  console.log(`${parsed.homeTeam} vs ${parsed.awayTeam} (${aetWithGoals.fixture.date})`)
  console.log(parsed)
  console.log(`→ Final: ${parsed.goals.home}-${parsed.goals.away}; 90-min (score.fulltime): ${parsed.fulltime.home}-${parsed.fulltime.away}`)
  console.log(`  (We save the 90-min score for cup-final-style matches.)`)
}
