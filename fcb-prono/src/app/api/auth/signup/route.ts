import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const { email, password, firstName, lastName } = await request.json()

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json({ error: 'Alle velden zijn verplicht' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Create user with auto-confirmed email via admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Update profile with name
  await supabase
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName })
    .eq('id', data.user.id)

  return NextResponse.json({ success: true })
}
