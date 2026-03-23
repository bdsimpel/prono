import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface ActivityEvent {
  type: 'signup' | 'result' | 'payment' | 'points'
  message: string
  metadata: Record<string, unknown>
  created_at: string
}

async function main() {
  const events: ActivityEvent[] = []

  // 1. Signup events from players
  const { data: players } = await supabase
    .from('players')
    .select('id, display_name, submitted_at')
    .order('submitted_at', { ascending: true })

  for (const p of players || []) {
    events.push({
      type: 'signup',
      message: `${p.display_name} doet mee!`,
      metadata: { player_id: p.id },
      created_at: p.submitted_at,
    })
  }
  console.log(`Signup events: ${players?.length ?? 0}`)

  // 2. Result events from results + matches + teams
  const [{ data: results }, { data: matches }, { data: teams }] = await Promise.all([
    supabase.from('results').select('match_id, home_score, away_score, entered_at'),
    supabase.from('matches').select('id, speeldag, home_team_id, away_team_id, is_cup_final'),
    supabase.from('teams').select('id, name'),
  ])

  const teamMap: Record<number, string> = {}
  for (const t of teams || []) teamMap[t.id] = t.name

  const matchMap: Record<number, typeof matches extends (infer T)[] | null ? T : never> = {}
  for (const m of matches || []) matchMap[m.id] = m

  for (const r of results || []) {
    const m = matchMap[r.match_id]
    if (!m) continue
    const home = teamMap[m.home_team_id] || '?'
    const away = teamMap[m.away_team_id] || '?'
    events.push({
      type: 'result',
      message: `${home} ${r.home_score} - ${r.away_score} ${away}`,
      metadata: { match_id: r.match_id, speeldag: m.speeldag },
      created_at: r.entered_at,
    })
  }
  console.log(`Result events: ${results?.length ?? 0}`)

  // 3. Payment events
  const { data: paidPlayers } = await supabase
    .from('players')
    .select('id, display_name, paid_at')
    .not('paid_at', 'is', null)

  for (const p of paidPlayers || []) {
    events.push({
      type: 'payment',
      message: `${p.display_name} heeft betaald`,
      metadata: { player_id: p.id },
      created_at: p.paid_at,
    })
  }
  console.log(`Payment events: ${paidPlayers?.length ?? 0}`)

  console.log(`\nTotal events to insert: ${events.length}`)

  if (events.length === 0) {
    console.log('No events to insert')
    return
  }

  // Clear existing events
  await supabase.from('activity_events').delete().neq('id', 0)

  // Insert in batches
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50)
    const { error } = await supabase.from('activity_events').insert(batch)
    if (error) {
      console.error(`Error inserting batch at ${i}:`, error)
      process.exit(1)
    }
  }

  console.log(`Inserted ${events.length} activity events`)
}

main().catch(console.error)
