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

    // Insert signup activity event
    await serviceClient.from('activity_events').insert({
      type: 'signup',
      message: `${trimmedName} doet mee!`,
      metadata: { player_id: player.id },
    })

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

    // Match historical name and increment edition player_count
    try {
      const { data: alltimeNames } = await serviceClient
        .from('alltime_scores')
        .select('player_name')

      if (alltimeNames && alltimeNames.length > 0) {
        const normalized = trimmedName.toLowerCase().trim().replace(/\s+/g, ' ')
        if (normalized.length <= 100) {
        let bestMatch = ''
        let bestSim = 0
        for (const { player_name } of alltimeNames) {
          const norm = player_name.toLowerCase().trim().replace(/\s+/g, ' ')
          if (norm.length > 100) continue
          const maxLen = Math.max(normalized.length, norm.length)
          if (maxLen === 0) continue
          // Simple Levenshtein similarity
          const m = normalized.length
          const n = norm.length
          const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
          for (let i = 0; i <= m; i++) dp[i][0] = i
          for (let j = 0; j <= n; j++) dp[0][j] = j
          for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
              dp[i][j] = normalized[i - 1] === norm[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
            }
          }
          const sim = (maxLen - dp[m][n]) / maxLen
          if (sim > bestSim) {
            bestSim = sim
            bestMatch = player_name
          }
        }
        if (bestSim >= 0.85) {
          await serviceClient
            .from('players')
            .update({ matched_historical_name: bestMatch })
            .eq('id', player.id)
        }
        } // end length guard
      }

      // Sync edition player_count with actual player count
      const { data: currentEdition } = await serviceClient
        .from('editions')
        .select('id')
        .eq('is_current', true)
        .single()

      if (currentEdition) {
        const { count } = await serviceClient
          .from('players')
          .select('*', { count: 'exact', head: true })

        await serviceClient
          .from('editions')
          .update({ player_count: count ?? 0 })
          .eq('id', currentEdition.id)
      }
    } catch (e) {
      // Non-critical: don't fail the signup if historical matching fails
      console.error('Historical matching error:', e)
    }

    revalidatePath('/', 'layout')

    return NextResponse.json({ success: true, playerId: player.id })
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
