import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { playerId, method } = await request.json()

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId is verplicht' }, { status: 400 })
    }

    if (!['cash', 'wero', 'transfer'].includes(method)) {
      return NextResponse.json({ error: 'Ongeldige betaalmethode' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const { error } = await serviceClient
      .from('players')
      .update({
        payment_status: 'pending',
        payment_method: method,
      })
      .eq('id', playerId)

    if (error) {
      console.error('Payment update error:', error)
      return NextResponse.json({ error: 'Kon betaling niet bijwerken' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
