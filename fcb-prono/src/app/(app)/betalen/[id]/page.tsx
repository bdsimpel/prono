import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PaymentSection from '@/components/PaymentSection'
import type { PaymentStatus } from '@/lib/types'
import Link from 'next/link'

export default async function BetalenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const serviceClient = await createServiceClient()

  const { data: player } = await serviceClient
    .from('players')
    .select('id, display_name, payment_status')
    .eq('id', id)
    .single()

  if (!player) {
    notFound()
  }

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold mb-2">Betaling</h1>
      <p className="text-gray-400 mb-6">
        Hallo <span className="text-white font-medium">{player.display_name}</span>
      </p>

      <PaymentSection
        playerId={player.id}
        playerName={player.display_name}
        initialStatus={player.payment_status as PaymentStatus}
      />

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm text-cb-gold hover:underline">
          Bekijk het klassement
        </Link>
      </div>
    </div>
  )
}
