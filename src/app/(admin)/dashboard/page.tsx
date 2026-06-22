// src/app/(admin)/dashboard/page.tsx
import { prisma }        from '@/lib/prisma'
import { MatchStatus }   from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'

const STATUS_LABEL: Record<string, string> = {
  DRAFT:    'Ruošiamas',
  OPEN:     'Registracija',
  CLOSED:   'Uždaryta',
  GROUPS:   'Grupių etapas',
  KNOCKOUT: 'Atkrintamosios',
  FINISHED: 'Baigtas',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  OPEN:     'bg-blue-100 text-blue-700',
  CLOSED:   'bg-yellow-100 text-yellow-700',
  GROUPS:   'bg-green-100 text-green-700',
  KNOCKOUT: 'bg-purple-100 text-purple-700',
  FINISHED: 'bg-gray-100 text-gray-500',
}
const CAT_LABEL: Record<string, string> = { M: '♂ Vyrai', W: '♀ Moterys', X: '⚥ Mix' }
function realKOMatches(matches: any[]) {
  const hasWBFinal = matches.some(m => m.round === 'F')
  const hasLBFinal = matches.some(m => m.round === 'LB-F')
  const loserSourceCount = (matchNumber: number | null) => {
    const firstRound = matches.some(m => m.round === 'R16') ? 'R16' : 'QF'
    return [(matchNumber ?? 1) * 2 - 1, (matchNumber ?? 1) * 2].filter(n => {
      const source = matches.find(m => m.round === firstRound && m.matchNumber === n)
      return source?.homeTeamId && source?.awayTeamId
    }).length
  }
  return matches.filter(m => {
    if (m.groupId) return true
    if (m.status === MatchStatus.FINISHED && (!m.homeTeamId || !m.awayTeamId)) return false
    if (m.round === 'LB-R1' && loserSourceCount(m.matchNumber ?? null) < 2) return false
    if (m.round === 'LB-R2' && loserSourceCount(m.matchNumber ?? null) === 0) return false
    if (!hasWBFinal && !hasLBFinal && m.round === 'LB-SF' && (m.matchNumber ?? 1) > 1) return false
    return true
  })
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: 'desc' },
    include: { _count: { select: { teams: true, groups: true, matches: true } } },
  })
  const realMatchCounts = new Map(
    await Promise.all(tournaments.map(async t => {
      const matches = await prisma.match.findMany({
        where: { tournamentId: t.id },
        select: { id: true, groupId: true, status: true, scheduledAt: true, homeTeamId: true, awayTeamId: true, round: true, matchNumber: true },
      })
      return [t.id, realKOMatches(matches).length] as const
    }))
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Turnyrai</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tournaments.length} viso</p>
        </div>
        {isAdmin && (
          <a
            href="/tournament/new"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + Naujas turnyras
          </a>
        )}
      </div>

      {/* List */}
      {tournaments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏐</div>
          <p className="font-medium text-gray-600">Nėra turnyra</p>
          <p className="text-sm mt-1">Sukurkite pirmą turnyra</p>
          {isAdmin && (
            <a href="/tournament/new"
              className="inline-block mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
              + Naujas turnyras
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <a
              key={t.id}
              href={`/tournament/${t.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {CAT_LABEL[t.category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    {t.location && <span>📍 {t.location}</span>}
                    <span>📅 {t.startsAt.toLocaleDateString('lt-LT')}</span>
                  </div>
                </div>
                <div className="shrink-0 flex gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{t._count.teams}</div>
                    <div className="text-xs text-gray-400">komandų</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{realMatchCounts.get(t.id) ?? t._count.matches}</div>
                    <div className="text-xs text-gray-400">rungtynių</div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
