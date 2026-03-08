import { NextResponse } from 'next/server'
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

  const { results } = await request.json()
  const serviceClient = await createServiceClient()

  for (const [matchId, score] of Object.entries(results) as [string, { home: string; away: string }][]) {
    const home = parseInt(score.home)
    const away = parseInt(score.away)
    if (isNaN(home) || isNaN(away)) continue

    await serviceClient
      .from('results')
      .upsert(
        { match_id: parseInt(matchId), home_score: home, away_score: away },
        { onConflict: 'match_id' }
      )
  }

  return NextResponse.json({ success: true })
}
