import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TournamentRulesGuide from '@/components/shared/TournamentRulesGuide'

export const dynamic = 'force-dynamic'

export default async function PublicRulesPage({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.slug },
    include: { config: true },
  })
  if (!tournament) notFound()

  return <TournamentRulesGuide config={tournament.config} />
}
