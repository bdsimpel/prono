import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resyncAllMatchEvents } from '@/lib/playoff-stats'
import { generateMetricEvents, insertMetricEvents } from '@/lib/activity-metrics'

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

  // Regenerate metric events (speeldag_top, top3, leader, streak) from the
  // fresh state. Mutable events are overwritten via dedup_key, one-shot events
  // (rare_exact, no_zero) are idempotent.
  const [{ data: allMatches }, { data: allResults }] = await Promise.all([
    serviceClient.from('matches').select('id, speeldag').not('speeldag', 'is', null),
    serviceClient.from('results').select('match_id'),
  ])
  const resultSet = new Set((allResults || []).map((r) => r.match_id))
  const completedMatchIds = (allMatches || [])
    .filter((m) => resultSet.has(m.id))
    .map((m) => m.id)

  if (completedMatchIds.length > 0) {
    const events = await generateMetricEvents({
      savedMatchIds: completedMatchIds,
      serviceClient,
      pointDeltas: [],
    })
    await insertMetricEvents(serviceClient, events)
  }

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true })
}
