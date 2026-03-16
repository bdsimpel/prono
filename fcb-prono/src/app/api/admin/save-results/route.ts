import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { recalculateScores } from '@/lib/recalculate'

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

  let saved = 0
  for (const [matchId, score] of Object.entries(results) as [string, { home: string; away: string }][]) {
    const home = parseInt(score.home)
    const away = parseInt(score.away)

    if (isNaN(home) || isNaN(away)) {
      // Empty/cleared score: delete the result if it exists
      await serviceClient
        .from('results')
        .delete()
        .eq('match_id', parseInt(matchId))
      continue
    }

    const { error } = await serviceClient
      .from('results')
      .upsert(
        { match_id: parseInt(matchId), home_score: home, away_score: away },
        { onConflict: 'match_id' }
      )
    if (!error) saved++
  }

  // Recalculate scores immediately
  const { playersUpdated } = await recalculateScores(serviceClient)

  revalidatePath('/', 'layout')

  return NextResponse.json({ success: true, resultsSaved: saved, playersUpdated })
}
