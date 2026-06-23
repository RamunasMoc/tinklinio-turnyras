import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PublicScheduleClient from '@/components/public/PublicScheduleClient'
import { filterRealMatches } from '@/lib/tournament/realMatches'

export const dynamic = 'force-dynamic'

export default async function PublicSchedulePage({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({ where: { id: params.slug }, select: { id: true } })
  if (!tournament) notFound()

  const matches = await prisma.match.findMany({
    where: { tournamentId: params.slug },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      group: true,
      sets: { orderBy: { setNumber: 'asc' } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }, { matchOrder: 'asc' }, { matchNumber: 'asc' }],
  })

  const visible = filterRealMatches(matches)
    .filter(match => match.scheduledAt || match.homeTeamId || match.awayTeamId)
  const serialized = visible.map(match => ({
    ...match,
    scheduledAt: match.scheduledAt?.toISOString() ?? null,
    startedAt: match.startedAt?.toISOString() ?? null,
    finishedAt: match.finishedAt?.toISOString() ?? null,
  }))

  return <PublicScheduleClient matches={serialized} />
}
