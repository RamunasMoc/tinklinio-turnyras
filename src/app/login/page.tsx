'use client'
// src/app/login/page.tsx
import { useState }        from 'react'
import { signIn }          from 'next-auth/react'
import { useRouter }       from 'next/navigation'
import Link                from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', {
      email, password, redirect: false,
    })
    setLoading(false)
    if (res?.ok) {
      router.push('/dashboard')
    } else {
      setError('Neteisingas el. paštas arba slaptažodis')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🏐</div>
          <h1 className="text-2xl font-semibold text-gray-900">Turnyro sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Prisijunkite norėdami tęsti</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">El. paštas</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="admin@turnyras.lt"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slaptažodis</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Jungiamasi...' : 'Prisijungti'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Demo: admin@turnyras.lt / admin123
        </p>
        <div className="mt-5 border-t border-gray-200 pt-5 text-center">
          <Link href="/watch" className="inline-flex min-h-10 items-center justify-center px-4 text-sm font-medium text-gray-700 hover:text-gray-950">
            Stebėti turnyrą →
          </Link>
        </div>
      </div>
    </div>
  )
}
