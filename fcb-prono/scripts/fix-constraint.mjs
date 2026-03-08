import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsocduiafkjlvvmsspvg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Step 1: Create a temporary function to drop the constraint
const { error: fnError } = await supabase.rpc('exec_sql', {
  query: `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_home_team_id_away_team_id_key`
})

if (fnError) {
  // The exec_sql function doesn't exist, so let's create it first via REST
  console.log('exec_sql not available, trying alternative...')

  // Try direct REST approach to create the function
  const res = await fetch(
    'https://jsocduiafkjlvvmsspvg.supabase.co/rest/v1/rpc/exec_sql',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_home_team_id_away_team_id_key`
      })
    }
  )

  if (!res.ok) {
    console.log('Cannot execute DDL via REST API.')
    console.log('You need to run this ONE line in the SQL Editor:')
    console.log('')
    console.log('  ALTER TABLE matches DROP CONSTRAINT matches_home_team_id_away_team_id_key;')
    console.log('')
    console.log('Then re-run this script to insert the cup final.')
    console.log('')

    // Try inserting the cup final anyway in case constraint was already dropped
    const { error: insertErr } = await supabase
      .from('matches')
      .insert({
        home_team_id: 4,
        away_team_id: 2,
        speeldag: null,
        match_datetime: null,
        is_cup_final: true,
      })

    if (insertErr) {
      console.log('Cup final insert failed (constraint still exists):', insertErr.message)
    } else {
      console.log('Cup final inserted successfully! (constraint was already gone)')
    }
    process.exit(0)
  }
}

// Step 2: Insert cup final
const { error: insertError } = await supabase
  .from('matches')
  .insert({
    home_team_id: 4,
    away_team_id: 2,
    speeldag: null,
    match_datetime: null,
    is_cup_final: true,
  })

if (insertError) {
  console.error('Insert error:', insertError.message)
} else {
  console.log('Cup final inserted successfully!')
}
