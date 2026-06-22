'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Ruošiamas', OPEN: 'Registracija', CLOSED: 'Registracija baigta',
  GROUPS: 'Grupių etapas', KNOCKOUT: 'Atkrintamosios', FINISHED: 'Baigtas',
}

export default function PublicShell({ tournament, liveCount, children }: {
  tournament: { id: string; name: string; location: string | null; startsAt: string; status: string }
  liveCount: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
        setUpdatedAt(new Date())
      }
    }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [router])

  const base = `/t/${tournament.id}`
  const nav = [
    { href: base, label: 'Apžvalga', short: 'Dabar' },
    { href: `${base}/schedule`, label: 'Tvarkaraštis', short: 'Rungtynės' },
    { href: `${base}/groups`, label: 'Grupės', short: 'Grupės' },
    { href: `${base}/bracket`, label: 'Atkrintamosios', short: 'KO' },
  ]
  const isActive = (href: string) => href === base ? pathname === base : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 sm:pb-0">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-gray-950 sm:text-2xl">{tournament.name}</h1>
                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{STATUS_LABELS[tournament.status] ?? tournament.status}</span>
              </div>
              <p className="text-sm text-gray-500">
                {new Date(tournament.startsAt).toLocaleDateString('lt-LT', { dateStyle: 'long' })}
                {tournament.location ? ` · ${tournament.location}` : ''}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {liveCount > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />LIVE {liveCount}
                </div>
              ) : (
                <div className="text-xs text-gray-400">Atnaujinta {updatedAt.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}</div>
              )}
            </div>
          </div>

          <nav className="mt-5 hidden gap-1 border-t border-gray-100 pt-3 sm:flex" aria-label="Turnyro skiltys">
            {nav.map(item => (
              <Link key={item.href} href={item.href} className={`px-3 py-2 text-sm font-medium ${isActive(item.href) ? 'border-b-2 border-gray-950 text-gray-950' : 'text-gray-500 hover:text-gray-900'}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-gray-200 bg-white sm:hidden" aria-label="Turnyro skiltys">
        {nav.map(item => (
          <Link key={item.href} href={item.href} className={`flex h-16 items-center justify-center px-1 text-center text-xs font-medium ${isActive(item.href) ? 'bg-gray-950 text-white' : 'text-gray-500'}`}>
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  )
}
