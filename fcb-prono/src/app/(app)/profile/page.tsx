import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: playerScore } = await supabase
    .from('player_scores')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { count: predCount } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: extraCount } = await supabase
    .from('extra_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">MIJN PROFIEL</h1>

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="space-y-4">
          <div>
            <span className="text-xs text-gray-500 uppercase">Naam</span>
            <p className="text-lg font-medium">{profile?.display_name || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase">Email</span>
            <p className="text-sm text-gray-300">{user.email}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500 uppercase">Rol</span>
            <p className="text-sm text-gray-300">{profile?.is_admin ? 'Admin' : 'Speler'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-cb-gold">{playerScore?.total_score ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Totaal punten</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-2xl font-bold text-white">{playerScore?.exact_matches ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Exacte scores</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-3">Voortgang</h2>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Wedstrijden ingevuld</span>
          <span className="text-white">{predCount ?? 0} / 31</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-gray-400">Extra vragen ingevuld</span>
          <span className="text-white">{extraCount ?? 0} / 8</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/player/${user.id}`}
          className="px-4 py-2 bg-cb-blue text-white rounded-lg text-sm font-medium hover:bg-cb-blue/90 transition-colors"
        >
          Bekijk mijn detail
        </Link>
      </div>
    </div>
  )
}
