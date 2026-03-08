const url = 'https://jsocduiafkjlvvmsspvg.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

async function query(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  })
  const data = await res.json()
  console.log(`\n${table}:`, res.ok ? `${JSON.stringify(data).slice(0, 200)}` : data)
}

await query('teams')
await query('matches')
await query('settings')
await query('extra_questions')
await query('profiles')
