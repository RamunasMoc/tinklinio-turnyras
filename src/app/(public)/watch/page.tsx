import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Ruošiamas', OPEN: 'Registracija', CLOSED: 'Registracija baigta',
  GROUPS: 'Grupių etapas', KNOCKOUT: 'Atkrintamosios', FINISHED: 'Baigtas',
}

export default async function WatchPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: 'desc' },
    include: {
      _count: { select: { teams: true, matches: true } },
      matches: { where: { status: 'IN_PROGRESS' }, select: { id: true } },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400">Stebėtojo aplinka</p>
            <h1 className="mt-1 text-xl font-semibold text-gray-950">Tinklinio turnyrai</h1>
          </div>
          <Link href="/login" className="text-sm font-medium text-gray-500 hover:text-gray-900">Administratoriui</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {tournaments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-400">Turnyrų dar nėra</div>
        ) : (
          <div className="space-y-3">
            {tournaments.map(tournament => (
              <Link key={tournament.id} href={`/t/${tournament.id}`} className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-400">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-gray-950">{tournament.name}</h2>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{STATUS_LABELS[tournament.status] ?? tournament.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {tournament.startsAt.toLocaleDateString('lt-LT', { dateStyle: 'long' })}
                      {tournament.location ? ` · ${tournament.location}` : ''}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">{tournament._count.teams} komandų · {tournament._count.matches} rungtynių</p>
                  </div>
                  {tournament.matches.length > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
