'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

type NavItem = {
  href: string
  label: string
  icon: string
  exact?: boolean
}

const ROOT_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Turnyrai', icon: '🏆' },
]

const TOURNAMENT_NAV = [
  { suffix: '', label: 'Apžvalga', icon: '⌂', exact: true },
  { suffix: '/teams', label: 'Komandos', icon: '♟' },
  { suffix: '/groups', label: 'Grupės', icon: '▦' },
  { suffix: '/schedule', label: 'Grupių tvarkaraštis', icon: '◷' },
  { suffix: '/results', label: 'Grupių rezultatai', icon: '✓' },
  { suffix: '/standings', label: 'Grupių lentelė', icon: '≡' },
  { suffix: '/knockout', label: 'Atkrintamosios', icon: '◇' },
  { suffix: '/knockout-schedule', label: 'KO tvarkaraštis', icon: '◷' },
  { suffix: '/knockout-results', label: 'KO rezultatai', icon: '✓' },
  { suffix: '/config', label: 'Nustatymai', icon: '⚙' },
  { suffix: '/rules', label: 'Taisyklės ir paaiškinimai', icon: '?' },
] as const

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`)
}

export default function AdminNav({ user }: { user: { name?: string; email?: string; role?: string } }) {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  const tournamentItems = useMemo<NavItem[]>(() => {
    const match = path.match(/^\/tournament\/([^/]+)/)
    if (!match || match[1] === 'new') return []
    const base = `/tournament/${match[1]}`
    return TOURNAMENT_NAV.map(item => ({ ...item, href: `${base}${item.suffix}` }))
  }, [path])

  useEffect(() => setOpen(false), [path])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  const navList = (mobile = false) => (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ROOT_NAV.map(item => (
          <NavLink key={item.href} item={item} path={path} onClick={mobile ? () => setOpen(false) : undefined} />
        ))}

        {tournamentItems.length > 0 && (
          <>
            <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase text-gray-400">Turnyras</div>
            {tournamentItems.map(item => (
              <NavLink key={item.href} item={item} path={path} onClick={mobile ? () => setOpen(false) : undefined} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-gray-100 px-3 py-4">
        <div className="px-3 py-2">
          <p className="truncate text-xs font-medium text-gray-900">{user.name ?? user.email}</p>
          <p className="text-xs text-gray-400">{user.role === 'ADMIN' ? 'Administratorius' : 'Teisėjas'}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs text-gray-500 transition-colors hover:bg-gray-100"
        >
          Atsijungti
        </button>
      </div>
    </>
  )

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden print:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="text-lg" aria-hidden="true">🏐</span>
          <span className="truncate text-sm font-semibold text-gray-900">Turnyro sistema</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-2xl leading-none text-gray-700"
          aria-label="Atidaryti administratoriaus meniu"
          aria-expanded={open}
        >
          ☰
        </button>
      </header>

      <aside className="hidden min-h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex print:hidden">
        <Brand />
        {navList()}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Administratoriaus meniu">
          <button
            type="button"
            className="absolute inset-0 bg-gray-950/40"
            onClick={() => setOpen(false)}
            aria-label="Uždaryti administratoriaus meniu"
          />
          <aside className="relative flex h-full w-[min(20rem,calc(100vw-3rem))] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100"
                aria-label="Uždaryti administratoriaus meniu"
              >
                ×
              </button>
            </div>
            {navList(true)}
          </aside>
        </div>
      )}
    </>
  )
}

function Brand() {
  return (
    <div className="px-4 py-5">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">🏐</span>
        <span className="text-sm font-semibold text-gray-900">Turnyro sistema</span>
      </div>
    </div>
  )
}

function NavLink({ item, path, onClick }: { item: NavItem; path: string; onClick?: () => void }) {
  const active = isActive(path, item)
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? 'bg-gray-900 font-medium text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span className="w-4 text-center" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  )
}
