import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/Navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Navigation isAdmin={isAdmin} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
