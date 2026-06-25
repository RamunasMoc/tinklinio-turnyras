import { prisma }       from '@/lib/prisma'
import { notFound }     from 'next/navigation'
import Link             from 'next/link'
import KnockoutClient   from '@/components/admin/KnockoutClient'
import { buildLuckyLoserPlan, getQualifiedTeams } from '@/lib/bracket'

export const dynamic = 'force-dynamic'

export default async function KnockoutPage({ params }: { params: { id: string } }) {
  const t = await prisma.tournament.findUnique({
    where: { id: params.id }, include: { config: true }
  })
  if (!t) notFound()

  const matches = await prisma.match.findMany({
    where:   { tournamentId: params.id, groupId: null },
    include: {
      sets:     { orderBy: { setNumber: 'asc' } },
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
  })

  // Gauti grupes su mačais FIVB korekcijai
  const groupsWithMatches = await prisma.group.findMany({
    where:   { tournamentId: params.id },
    orderBy: { order: 'asc' },
    include: {
      teams:   {
        include: { team: true },
        orderBy: [{ groupPoints:'desc' }, { groupWins:'desc' }],
      },
      matches: {
        where:   { status: 'FINISHED' },
        include: { sets: true },
      },
    },
  })

  const qualifiedTeams = await prisma.tournamentTeam.findMany({
    where:   { tournamentId: params.id, groupId: { not: null } },
    include: { team: true, group: true },
    orderBy: [{ groupPoints: 'desc' }, { groupWins: 'desc' }],
  })

  const groupsForBracket = groupsWithMatches.map(group => ({
    ...group,
    advanceCount: t.config?.advancePerGroup ?? 2,
  }))
  const bracketQualified = t.config?.knockoutFormat === 'LUCKY_LOSER'
    ? (() => {
        const plan = buildLuckyLoserPlan(groupsForBracket as any, t.config as any)
        return [...plan.direct, ...plan.llSorted]
      })()
    : getQualifiedTeams(
        groupsForBracket as any,
        t.config?.advanceMode === 'total' ? t.config?.advanceTotal ?? undefined : undefined,
        t.config?.groupPointSystem,
      )
  const teamsById = new Map(qualifiedTeams.map(team => [team.id, team]))
  const serverQualifiedTeams = bracketQualified.flatMap(entry => {
    const team = teamsById.get(entry.tournamentTeamId)
    if (!team) return []
    return [{
      team,
      group: entry.fromGroup ?? team.group?.name ?? '?',
      pos: entry.fromPosition ?? 0,
      seed: entry.seed ?? 0,
    }]
  })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <Link href={`/tournament/${params.id}`}>{t.name}</Link><span>/</span>
        <span className="text-gray-700">Atkrintamosios</span>
      </div>
      <KnockoutClient
        tournamentId={params.id}
        config={t.config as any}
        initialMatches={matches as any}
        qualifiedTeams={qualifiedTeams as any}
        serverQualifiedTeams={serverQualifiedTeams as any}
        groupsWithMatches={groupsWithMatches as any}
      />
    </div>
  )
}
