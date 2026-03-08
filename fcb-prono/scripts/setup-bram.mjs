import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsocduiafkjlvvmsspvg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data } = await supabase.auth.admin.listUsers()
const bram = data.users.find(u => u.email === 'bram.desimpelaere@outlook.com')
if (bram) {
  await supabase
    .from('profiles')
    .update({ first_name: 'Bram', last_name: 'Desimpelaere', is_admin: true })
    .eq('id', bram.id)
  console.log('Updated Bram profile with admin rights')
} else {
  console.log('User not found')
}
