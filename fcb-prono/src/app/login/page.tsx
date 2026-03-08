'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        // Use server-side API route to create user with auto-confirmed email
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, firstName, lastName }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        // Now sign in with the created account
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }

      router.push('/')
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
          <p className="text-gray-400 mt-2">Play-off 2025</p>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex mb-6">
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                !isSignUp
                  ? 'bg-cb-blue text-white'
                  : 'bg-cb-dark text-gray-400 hover:text-white'
              }`}
            >
              Inloggen
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                isSignUp
                  ? 'bg-cb-blue text-white'
                  : 'bg-cb-dark text-gray-400 hover:text-white'
              }`}
            >
              Registreren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Voornaam</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={isSignUp}
                    className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Achternaam</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={isSignUp}
                    className="w-full px-3 py-2 bg-cb-dark border border-border rounded-lg text-white text-sm focus:outline-none focus:border-cb-blue"
                  />
                </div>
              </div>
            )}

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
              {loading ? '...' : isSignUp ? 'Registreren' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
