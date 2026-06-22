import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/public/PublicShell'

export const dynamic = 'force-dynamic'

export default async function PublicTournamentLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.slug },
    select: { id: true, name: true, location: true, startsAt: true, status: true },
  })
  if (!tournament) notFound()

  const liveCount = await prisma.match.count({
    where: { tournamentId: params.slug, status: 'IN_PROGRESS' },
  })

  return (
    <PublicShell tournament={{ ...tournament, startsAt: tournament.startsAt.toISOString() }} liveCount={liveCount}>
      {children}
    </PublicShell>
  )
}
