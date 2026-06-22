import { prisma }         from '@/lib/prisma'
import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import TeamsClient        from '@/components/admin/TeamsClient'

export default async function TeamsPage({ params, searchParams }: { params: { id: string }; searchParams?: { tab?: string } }) {
  const t = await prisma.tournament.findUnique({ where: { id: params.id } })
  if (!t) notFound()

  const tTeams = await prisma.tournamentTeam.findMany({
    where:   { tournamentId: params.id },
    include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } }, group: true },
    orderBy: [{ seeded: 'desc' }, { seedRank: 'asc' }, { registeredAt: 'asc' }],
  })
  const initialTab = searchParams?.tab === 'add'
    ? 'add'
    : searchParams?.tab === 'favorites'
      ? 'favorites'
      : 'list'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">Komandos</span>
      </div>
      <TeamsClient
        tournamentId={params.id}
        initialTeams={tTeams as any}
        initialTab={initialTab}
      />
    </div>
  )
}
