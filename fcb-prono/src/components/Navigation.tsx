'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Klassement', icon: '🏆' },
  { href: '/matches', label: 'Wedstrijden', icon: '⚽' },
  { href: '/predictions', label: 'Prono', icon: '📝' },
  { href: '/profile', label: 'Profiel', icon: '👤' },
]

export default function Navigation({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredItems = isAdmin ? navItems.filter(item => item.href !== '/predictions') : navItems

  return (
    <>
      {/* Desktop header */}
      <header className="bg-cb-navy border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white tracking-wide">
            FCB <span className="text-cb-gold">PRONO</span> 2025
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {filteredItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'text-cb-gold'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors ${
                  pathname === '/admin'
                    ? 'text-cb-gold'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Admin
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Uitloggen
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cb-navy border-t border-border z-50">
        <div className="flex justify-around py-2">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                pathname === item.href
                  ? 'text-cb-gold'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                pathname === '/admin'
                  ? 'text-cb-gold'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <span>Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
