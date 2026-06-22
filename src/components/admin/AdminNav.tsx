'use client'
// src/components/admin/AdminNav.tsx
import { usePathname }   from 'next/navigation'
import { signOut }       from 'next-auth/react'

const NAV = [
  { href: '/dashboard',        label: 'Turnyrai',     icon: '🏆' },
]

export default function AdminNav({ user }: { user: { name?: string; email?: string; role?: string } }) {
  const path = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏐</span>
          <span className="font-semibold text-gray-900 text-sm">Turnyro sistema</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(item => (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              path.startsWith(item.href)
                ? 'bg-gray-900 text-white font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-900 truncate">{user.name ?? user.email}</p>
          <p className="text-xs text-gray-400">{user.role === 'ADMIN' ? 'Administratorius' : 'Teisėjas'}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full mt-1 px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Atsijungti
        </button>
      </div>
    </aside>
  )
}
