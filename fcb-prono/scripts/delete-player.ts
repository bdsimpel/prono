import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const name = args.find(a => !a.startsWith('--'))

  if (!name) {
    console.error('Usage: npx tsx scripts/delete-player.ts "Player Name" [--dry-run]')
    process.exit(1)
  }

  if (dryRun) {
    console.log('=== DRY RUN — no data will be deleted ===\n')
  }

  // Look up player (case-insensitive)
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .ilike('display_name', name)
    .single()

  if (error || !player) {
    console.error(`Player "${name}" not found`)
    process.exit(1)
  }

  // Show player info
  console.log('\nPlayer found:')
  console.log(`  ID:             ${player.id}`)
  console.log(`  Name:           ${player.display_name}`)
  console.log(`  Submitted:      ${player.submitted_at}`)
  console.log(`  Payment status: ${player.payment_status}`)
  console.log(`  Favorite team:  ${player.favorite_team || '-'}`)

  // Count related records
  const [
    { count: predCount },
    { count: extraCount },
    { data: score },
  ] = await Promise.all([
    supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', player.id),
    supabase.from('extra_predictions').select('*', { count: 'exact', head: true }).eq('user_id', player.id),
    supabase.from('player_scores').select('total_score').eq('user_id', player.id).single(),
  ])

  // Count activity events
  const { count: eventCount } = await supabase
    .from('activity_events')
    .select('*', { count: 'exact', head: true })
    .filter('metadata->>player_id', 'eq', player.id)

  // Get current edition and actual player count
  const { data: currentEdition } = await supabase
    .from('editions')
    .select('id, player_count')
    .eq('is_current', true)
    .single()

  const { count: actualPlayerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })

  console.log(`  Predictions:    ${predCount ?? 0}`)
  console.log(`  Extra answers:  ${extraCount ?? 0}`)
  console.log(`  Total score:    ${score?.total_score ?? 0}`)
  console.log(`  Activity events: ${eventCount ?? 0}`)
  if (currentEdition) {
    const newCount = (actualPlayerCount ?? 0) - 1
    console.log(`  Edition count:  ${currentEdition.player_count} (stored) → ${newCount} (actual after delete)`)
  }

  console.log('\nThe following will be deleted:')
  console.log(`  - ${predCount ?? 0} predictions`)
  console.log(`  - ${extraCount ?? 0} extra predictions`)
  console.log(`  - 1 player_scores record`)
  console.log(`  - ${eventCount ?? 0} activity events`)
  console.log(`  - 1 player record`)

  if (dryRun) {
    console.log('\n=== DRY RUN complete — nothing was deleted ===')
    process.exit(0)
  }

  const confirmed = await askConfirmation(`\nDelete "${player.display_name}" and all related data? (y/n) `)
  if (!confirmed) {
    console.log('Cancelled')
    process.exit(0)
  }

  // 1. Delete activity events referencing this player
  const { data: deletedEvents } = await supabase
    .from('activity_events')
    .delete()
    .filter('metadata->>player_id', 'eq', player.id)
    .select('id')

  console.log(`\nDeleted ${deletedEvents?.length ?? 0} activity events`)

  // 2. Sync edition player_count after delete
  // (done after player delete below)

  // 3. Delete related records manually (no CASCADE on these FKs)
  await supabase.from('predictions').delete().eq('user_id', player.id)
  console.log(`Deleted ${predCount ?? 0} predictions`)

  await supabase.from('extra_predictions').delete().eq('user_id', player.id)
  console.log(`Deleted ${extraCount ?? 0} extra predictions`)

  await supabase.from('player_scores').delete().eq('user_id', player.id)
  console.log('Deleted player_scores record')

  // 4. Delete the player
  const { error: deleteError } = await supabase
    .from('players')
    .delete()
    .eq('id', player.id)

  if (deleteError) {
    console.error('Error deleting player:', deleteError)
    process.exit(1)
  }

  // Sync edition player_count with actual remaining players
  if (currentEdition) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
    await supabase
      .from('editions')
      .update({ player_count: count ?? 0 })
      .eq('id', currentEdition.id)
    console.log(`Updated edition player_count to ${count ?? 0}`)
  }

  console.log(`Deleted player "${player.display_name}" and all related data`)
}

main().catch(console.error)
