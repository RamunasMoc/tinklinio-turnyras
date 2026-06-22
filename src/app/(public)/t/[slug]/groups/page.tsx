import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import StandingsClient from '@/components/admin/StandingsClient'

export const dynamic = 'force-dynamic'

export default async function PublicGroupsPage({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.slug },
    include: { config: true },
  })
  if (!tournament) notFound()

  const groups = await prisma.group.findMany({
    where: { tournamentId: params.slug },
    orderBy: { order: 'asc' },
    include: {
      teams: {
        include: {
          team: {
            include: { players: { orderBy: { playerOrder: 'asc' } } },
          },
        },
        orderBy: [{ groupPoints: 'desc' }, { groupSetsWon: 'desc' }, { groupPtsWon: 'desc' }],
      },
      matches: {
        where: { status: 'FINISHED' },
        select: { homeTeamId: true, awayTeamId: true, winnerId: true, status: true },
      },
    },
  })

  return (
    <StandingsClient
      tournamentId={params.slug}
      initialGroups={groups as any}
      advanceCount={tournament.config?.advancePerGroup ?? 2}
      publicView
    />
  )
}
