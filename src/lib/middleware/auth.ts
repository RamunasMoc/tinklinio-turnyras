// ============================================================
// src/lib/middleware/auth.ts
// NextAuth sesijos tikrinimas API route'uose
// ============================================================

import { getServerSession }      from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions }           from '@/lib/auth'

export type Role = 'ADMIN' | 'REFEREE'

// Apsaugoti route'ą — grąžina sesiją arba 401
export async function requireAuth(roles: Role[] = ['ADMIN']) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const role = (session.user as any).role as Role
  if (!roles.includes(role)) return null
  return session
}

// HOF apvynioti route handler'į autentifikacija
export function withAuth(
  handler: (req: NextRequest, ctx: any, session: any) => Promise<Response>,
  roles:   Role[] = ['ADMIN'],
) {
  return async (req: NextRequest, ctx: any) => {
    const session = await requireAuth(roles)
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Neprisijungta' }, { status: 401 })
    }
    return handler(req, ctx, session)
  }
}

// ─── Pagalbinės funkcijos ─────────────────────────────────────

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function jsonErr(error: string, status = 400, field?: string) {
  return NextResponse.json({ ok: false, error, ...(field ? { field } : {}) }, { status })
}

// Saugiai ištraukti dinaminius params (Next.js 14)
export function getParam(ctx: any, key: string): string {
  return ctx?.params?.[key] ?? ''
}
