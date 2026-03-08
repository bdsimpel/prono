import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jsocduiafkjlvvmsspvg.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_EMAIL = 'test@fcbprono.be'
const TEST_PASSWORD = 'testtest123'

// Create user via admin API (auto-confirms email)
const { data: userData, error: userError } = await supabase.auth.admin.createUser({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  email_confirm: true,
})

if (userError) {
  if (userError.message.includes('already been registered')) {
    console.log('User already exists, fetching...')
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existing = users.find(u => u.email === TEST_EMAIL)
    if (existing) {
      // Update profile
      await supabase
        .from('profiles')
        .update({ first_name: 'Bram', last_name: 'Test', is_admin: true })
        .eq('id', existing.id)
      console.log(`\nUser ID: ${existing.id}`)
    }
  } else {
    console.error('Error creating user:', userError.message)
    process.exit(1)
  }
} else {
  console.log(`Created user: ${userData.user.id}`)

  // Update profile with name + admin
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ first_name: 'Bram', last_name: 'Test', is_admin: true })
    .eq('id', userData.user.id)

  if (profileError) {
    console.error('Profile update error:', profileError.message)
  }
}

console.log(`\n✅ Test account ready:`)
console.log(`   Email:    ${TEST_EMAIL}`)
console.log(`   Password: ${TEST_PASSWORD}`)
console.log(`   Admin:    yes`)
