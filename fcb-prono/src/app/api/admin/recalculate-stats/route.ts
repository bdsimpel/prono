import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resyncAllMatchEvents } from '@/lib/playoff-stats'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = await createServiceClient()
  await resyncAllMatchEvents(serviceClient)

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true })
}
