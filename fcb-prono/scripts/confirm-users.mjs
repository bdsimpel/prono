import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsocduiafkjlvvmsspvg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data } = await supabase.auth.admin.listUsers()
for (const u of data.users) {
  if (!u.email_confirmed_at) {
    await supabase.auth.admin.updateUserById(u.id, { email_confirm: true })
    console.log('Confirmed:', u.email)
  } else {
    console.log('Already confirmed:', u.email)
  }
}
