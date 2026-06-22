import { prisma }     from '@/lib/prisma'
import { notFound }   from 'next/navigation'
import Link           from 'next/link'
import KOScheduleClient from '@/components/admin/KOScheduleClient'

export const dynamic = 'force-dynamic'

export default async function KOSchedulePage({ params, searchParams }: { params: { id: string }; searchParams?: { round?: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id }, include: { config: true }
  })
  if (!t) notFound()

  const matches = await prisma.match.findMany({
    where:   { tournamentId: params.id, groupId: null },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      sets: { orderBy: { setNumber: 'asc' } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }],
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">KO tvarkaraštis</span>
      </div>
      <KOScheduleClient
        tournamentId={params.id}
        config={t.config as any}
        initialMatches={matches as any}
        startsAt={t.startsAt.toISOString()}
        initialRound={searchParams?.round ?? 'all'}
      />
    </div>
  )
}
