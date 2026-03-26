import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { playerId, status } = await request.json()

  if (!playerId || !['paid', 'unpaid'].includes(status)) {
    return NextResponse.json({ error: 'Ongeldige parameters' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  const updateData: Record<string, unknown> = {
    payment_status: status,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  }

  if (status === 'unpaid') {
    updateData.payment_method = null
  }

  const { error } = await serviceClient
    .from('players')
    .update(updateData)
    .eq('id', playerId)

  if (error) {
    console.error('Admin payment update error:', error)
    return NextResponse.json({ error: 'Kon betaling niet bijwerken' }, { status: 500 })
  }

  // Insert payment activity event
  if (status === 'paid') {
    const { data: player } = await serviceClient
      .from('players')
      .select('display_name')
      .eq('id', playerId)
      .single()

    if (player) {
      await serviceClient.from('activity_events').insert({
        type: 'payment',
        message: `Betaling ${player.display_name} bevestigd`,
        metadata: { player_id: playerId },
      })
    }
  }

  revalidatePath(`/player/${playerId}`)

  return NextResponse.json({ success: true })
}
