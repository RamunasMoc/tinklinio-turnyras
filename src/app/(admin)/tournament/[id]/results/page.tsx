import { prisma }     from '@/lib/prisma'
import { notFound }   from 'next/navigation'
import Link           from 'next/link'
import ResultsClient  from '@/components/admin/ResultsClient'

export const dynamic = 'force-dynamic'

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id }, include: { config: true }
  })
  if (!t) notFound()

  const matches = await prisma.match.findMany({
    where:   { tournamentId: params.id, groupId: { not: null } },
    include: {
      sets:     { orderBy: { setNumber: 'asc' } },
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      group:    true,
    },
    orderBy: [{ scheduledAt: 'asc' }, { matchNumber: 'asc' }],
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">Grupių rezultatai</span>
      </div>
      <ResultsClient
        tournamentId={params.id}
        initialMatches={matches as any}
        setFormat={(t.config as any)?.groupSetFormat ?? 'BO2_21'}
        tbPoints={(t.config as any)?.groupTiebreakPoints ?? 15}
      
        isKO={false}
      />
    </div>
  )
}
