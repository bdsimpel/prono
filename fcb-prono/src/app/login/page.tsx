'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError

      router.push('/admin')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            FCB <span className="text-cb-gold">PRONO</span>
          </h1>
          <p className="text-gray-400 mt-2">Admin login</p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cb-blue text-white font-medium rounded-lg hover:bg-cb-blue/90 transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
