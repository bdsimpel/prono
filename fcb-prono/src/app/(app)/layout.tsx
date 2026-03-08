import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navigation from '@/components/Navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, first_name')
    .eq('id', user.id)
    .single()

  // If profile has no first_name, redirect to complete profile
  if (profile && !profile.first_name) {
    redirect('/complete-profile')
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Navigation isAdmin={profile?.is_admin} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
