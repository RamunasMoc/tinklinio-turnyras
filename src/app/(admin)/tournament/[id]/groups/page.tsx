import { prisma }         from '@/lib/prisma'
import { notFound }       from 'next/navigation'
import Link               from 'next/link'
import GroupsClient       from '@/components/admin/GroupsClient'
import { groupAdvanceCounts } from '@/lib/tournament/qualification'

export default async function GroupsPage({ params }: { params: { id: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id }, include: { config: true }
  })
  if (!t) notFound()

  const groups = await prisma.group.findMany({
    where: { tournamentId: params.id }, orderBy: { order: 'asc' },
    include: { teams: { include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } } }, orderBy: { groupPoints: 'desc' } }, matches: { include: { sets: true }, orderBy: { matchNumber: 'asc' } } },
  })

  const allTeams = await prisma.tournamentTeam.findMany({
    where: { tournamentId: params.id }, include: { team: true },
    orderBy: [{ seeded: 'desc' }, { seedRank: 'asc' }],
  })
  const advanceCounts = groupAdvanceCounts(
    t.config ?? {},
    groups.length,
    groups.map(group => group.maxTeams),
  )
  const groupsForDisplay = groups.map((group, index) => ({
    ...group,
    advanceCount: advanceCounts[index] ?? group.advanceCount,
  }))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">Grupės</span>
      </div>
      <GroupsClient tournamentId={params.id} config={t.config as any} initialGroups={groupsForDisplay as any} allTeams={allTeams as any} />
    </div>
  )
}
