import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_admin ? user : null
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { playerId, subgroupId } = await request.json()
  if (!playerId || !subgroupId) {
    return NextResponse.json({ error: 'playerId en subgroupId zijn verplicht' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from('player_subgroups')
    .insert({ player_id: playerId, subgroup_id: subgroupId })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: true }) // already a member
    }
    return NextResponse.json({ error: 'Kon lid niet toevoegen' }, { status: 500 })
  }

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { playerId, subgroupId } = await request.json()
  if (!playerId || !subgroupId) {
    return NextResponse.json({ error: 'playerId en subgroupId zijn verplicht' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { error } = await serviceClient
    .from('player_subgroups')
    .delete()
    .eq('player_id', playerId)
    .eq('subgroup_id', subgroupId)

  if (error) {
    return NextResponse.json({ error: 'Kon lid niet verwijderen' }, { status: 500 })
  }

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
