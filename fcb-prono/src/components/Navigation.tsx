'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TrophyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14M5 3v5a7 7 0 0014 0V3M5 3H3v3a3 3 0 003 3M19 3h2v3a3 3 0 01-3 3M12 15v4M8 19h8" />
  </svg>
)

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const PersonAddIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
)

const GearIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const publicNavItems = [
  { href: '/', label: 'Klassement', icon: <TrophyIcon /> },
  { href: '/matches', label: 'Wedstrijden', icon: <CalendarIcon /> },
]

export default function Navigation({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-50 bg-[#0a0e14]/95 backdrop-blur-md border-b border-white/[0.06] hidden md:block">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-cb-blue flex items-center justify-center">
              <span className="heading-display text-[10px] text-white font-bold tracking-wider">FCB</span>
            </div>
            <span className="heading-display text-lg text-white tracking-wider">
              FCB <span className="font-bold">PRONO</span> <span className="text-gray-500">2025</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="flex items-center gap-1">
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                  isActive(item.href)
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-lg ${
                  isActive('/admin')
                    ? 'bg-white/[0.08] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <GearIcon />
                Admin
              </Link>
            )}
            <Link
              href="/meedoen"
              className={`flex items-center gap-2 ml-2 px-5 py-2 text-sm font-semibold rounded-lg border transition-all ${
                isActive('/meedoen')
                  ? 'bg-cb-blue text-white border-cb-blue'
                  : 'bg-transparent text-cb-blue border-cb-blue/60 hover:bg-cb-blue/10 hover:border-cb-blue'
              }`}
            >
              <PersonAddIcon />
              Meedoen
            </Link>
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="ml-3 text-sm text-gray-500 hover:text-white transition-colors"
              >
                Uitloggen
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0e14]/95 backdrop-blur-lg border-t border-white/[0.06] z-50">
        <div className="flex justify-around py-2">
          {publicNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-all ${
                isActive(item.href)
                  ? 'text-white'
                  : 'text-gray-500'
              }`}
            >
              <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <Link
            href="/meedoen"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-all ${
              isActive('/meedoen')
                ? 'text-white'
                : 'text-gray-500'
            }`}
          >
            <span className="[&>svg]:w-5 [&>svg]:h-5"><PersonAddIcon /></span>
            <span>Meedoen</span>
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-all ${
                isActive('/admin')
                  ? 'text-white'
                  : 'text-gray-500'
              }`}
            >
              <span className="[&>svg]:w-5 [&>svg]:h-5"><GearIcon /></span>
              <span>Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
