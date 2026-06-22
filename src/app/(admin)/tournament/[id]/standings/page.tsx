import { prisma }        from '@/lib/prisma'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import StandingsClient   from '@/components/admin/StandingsClient'

export const dynamic = 'force-dynamic'

export default async function StandingsPage({ params }: { params: { id: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id }, include: { config: true }
  })
  if (!t) notFound()

  const groups = await prisma.group.findMany({
    where:   { tournamentId: params.id },
    orderBy: { order: 'asc' },
    include: {
      teams: {
        include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } } },
        orderBy: [{ groupPoints: 'desc' }, { groupSetsWon: 'desc' }, { groupPtsWon: 'desc' }],
      },
      matches: {
        where: { status: 'FINISHED' },
        select: { homeTeamId: true, awayTeamId: true, winnerId: true, status: true },
      },
    },
  })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">Grupių lentelė</span>
      </div>
      <StandingsClient
        tournamentId={params.id}
        initialGroups={groups as any}
        advanceCount={t.config?.advancePerGroup ?? 2}
      />
    </div>
  )
}
