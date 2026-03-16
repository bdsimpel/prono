import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { displayName, predictions, extraAnswers, favoriteTeam } = body

    // Validate displayName
    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }
    const trimmedName = displayName.trim()
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Naam moet tussen 2 en 50 tekens zijn' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    // Auto-lock based on deadline setting
    const { data: deadlineSetting } = await serviceClient
      .from('settings')
      .select('value')
      .eq('key', 'deadline')
      .single()

    if (deadlineSetting?.value && Date.now() >= new Date(deadlineSetting.value).getTime()) {
      return NextResponse.json({ error: 'Inschrijvingen zijn gesloten' }, { status: 403 })
    }

    // Check duplicate name (case-insensitive)
    const { data: existing } = await serviceClient
      .from('players')
      .select('id')
      .ilike('display_name', trimmedName)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Deze naam is al in gebruik' }, { status: 409 })
    }

    // Validate predictions: must be array of 31
    if (!Array.isArray(predictions) || predictions.length !== 31) {
      return NextResponse.json({ error: 'Alle 31 wedstrijden moeten ingevuld zijn' }, { status: 400 })
    }
    for (const p of predictions) {
      if (p.matchId == null || p.home == null || p.away == null) {
        return NextResponse.json({ error: 'Alle scores moeten ingevuld zijn' }, { status: 400 })
      }
      const home = Number(p.home)
      const away = Number(p.away)
      if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || home > 9 || away < 0 || away > 9) {
        return NextResponse.json({ error: 'Scores moeten tussen 0 en 9 zijn' }, { status: 400 })
      }
    }

    // Validate extra answers: must be array of 8
    if (!Array.isArray(extraAnswers) || extraAnswers.length !== 8) {
      return NextResponse.json({ error: 'Alle 8 extra vragen moeten beantwoord zijn' }, { status: 400 })
    }
    for (const a of extraAnswers) {
      if (a.questionId == null || !a.answer || typeof a.answer !== 'string' || !a.answer.trim()) {
        return NextResponse.json({ error: 'Alle extra vragen moeten beantwoord zijn' }, { status: 400 })
      }
    }

    // Insert player
    const { data: player, error: playerError } = await serviceClient
      .from('players')
      .insert({
        display_name: trimmedName,
        favorite_team: favoriteTeam && typeof favoriteTeam === 'string' && favoriteTeam.trim() ? favoriteTeam.trim() : null,
      })
      .select('id')
      .single()

    if (playerError || !player) {
      console.error('Player insert error:', playerError)
      return NextResponse.json({ error: 'Kon speler niet aanmaken' }, { status: 500 })
    }

    // Bulk insert predictions
    const predictionRows = predictions.map((p: { matchId: number; home: number; away: number }) => ({
      user_id: player.id,
      match_id: p.matchId,
      home_score: Number(p.home),
      away_score: Number(p.away),
    }))

    const { error: predError } = await serviceClient
      .from('predictions')
      .insert(predictionRows)

    if (predError) {
      console.error('Predictions insert error:', predError)
      return NextResponse.json({ error: 'Kon voorspellingen niet opslaan' }, { status: 500 })
    }

    // Bulk insert extra predictions
    const extraRows = extraAnswers.map((a: { questionId: number; answer: string }) => ({
      user_id: player.id,
      question_id: a.questionId,
      answer: a.answer.trim(),
    }))

    const { error: extraError } = await serviceClient
      .from('extra_predictions')
      .insert(extraRows)

    if (extraError) {
      console.error('Extra predictions insert error:', extraError)
      return NextResponse.json({ error: 'Kon extra antwoorden niet opslaan' }, { status: 500 })
    }

    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true, playerId: player.id })
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
