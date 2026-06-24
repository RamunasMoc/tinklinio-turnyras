import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PublicMatchCard from '@/components/public/PublicMatchCard'
import PublicQualifiedTeamsTable from '@/components/public/PublicQualifiedTeamsTable'
import { ExampleDEBracket } from '@/components/admin/KnockoutClient'
import { ROUND_ORDER, roundLabel } from '@/lib/publicTournament'
import { buildLuckyLoserPlan, getQualifiedTeams } from '@/lib/bracket'
import KnockoutResultsTable from '@/components/shared/KnockoutResultsTable'
import { buildKnockoutStandings } from '@/lib/tournament/knockoutStandings'

export const dynamic = 'force-dynamic'

export default async function PublicBracketPage({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.slug },
    include: {
      config: true,
      groups: {
        orderBy: { order: 'asc' },
        include: {
          teams: { include: { team: true } },
          matches: {
            where: { status: 'FINISHED' },
            include: { sets: true },
          },
        },
      },
    },
  })
  if (!tournament) notFound()

  const matches = await prisma.match.findMany({
    where: { tournamentId: params.slug, groupId: null },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      sets: { orderBy: { setNumber: 'asc' } },
    },
    orderBy: [{ matchOrder: 'asc' }, { matchNumber: 'asc' }],
  })

  const byRound = new Map<string, typeof matches>()
  for (const match of matches) {
    const round = match.round ?? 'KO'
    byRound.set(round, [...(byRound.get(round) ?? []), match])
  }
  const rounds = [...byRound.entries()].sort(([a, aMatches], [b, bMatches]) => {
    const ai = ROUND_ORDER.indexOf(a)
    const bi = ROUND_ORDER.indexOf(b)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return (aMatches[0]?.matchOrder ?? 999) - (bMatches[0]?.matchOrder ?? 999)
  })

  const config = tournament.config
  const groupsWithCount = tournament.groups.map(group => ({
    ...group,
    advanceCount: config?.advancePerGroup ?? group.advanceCount,
  }))
  const qualified = config?.knockoutFormat === 'LUCKY_LOSER'
    ? (() => {
        const plan = buildLuckyLoserPlan(groupsWithCount, config)
        return [...plan.direct, ...plan.llSorted]
      })()
    : config
      ? getQualifiedTeams(
          groupsWithCount,
          config.advanceMode === 'total' ? config.advanceTotal : undefined,
          config.groupPointSystem,
        )
      : []
  const directCount = (config?.advancePerGroup ?? 0) * tournament.groups.length
  const teamsById = new Map(
    tournament.groups.flatMap(group => group.teams).map(team => [team.id, team]),
  )
  const qualifiedRows = qualified.flatMap((entry, index) => {
    const tournamentTeam = teamsById.get(entry.tournamentTeamId)
    if (!tournamentTeam) return []
    return [{
      id: tournamentTeam.id,
      seed: entry.seed,
      group: entry.fromGroup,
      position: entry.fromPosition,
      wildCard: config?.knockoutFormat === 'LUCKY_LOSER'
        ? index >= directCount
        : config?.advanceMode === 'total' && index >= directCount,
      team: {
        name: tournamentTeam.team.name,
        club: tournamentTeam.team.club,
        groupPoints: tournamentTeam.groupPoints,
        groupWins: tournamentTeam.groupWins,
        groupLosses: tournamentTeam.groupLosses,
        groupSetsWon: tournamentTeam.groupSetsWon,
        groupSetsLost: tournamentTeam.groupSetsLost,
        groupPtsWon: tournamentTeam.groupPtsWon,
        groupPtsLost: tournamentTeam.groupPtsLost,
      },
    }]
  })
  const knockoutStandings = buildKnockoutStandings(
    qualified.flatMap(entry => {
      const tournamentTeam = teamsById.get(entry.tournamentTeamId)
      return tournamentTeam ? [{
        id: tournamentTeam.id,
        name: tournamentTeam.team.name,
        club: tournamentTeam.team.club,
        seed: entry.seed,
      }] : []
    }),
    matches,
    config?.knockoutFormat,
  )

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase text-gray-400">{formatLabel(tournament.config?.knockoutFormat)}</p>
        <h2 className="mt-1 text-2xl font-semibold text-gray-950">Atkrintamųjų tinklelis</h2>
      </div>

      <PublicQualifiedTeamsTable rows={qualifiedRows} />

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center text-sm text-gray-400">Atkrintamųjų schema dar nesugeneruota</div>
      ) : config?.knockoutFormat === 'DOUBLE_ELIMINATION' ? (
        <ExampleDEBracket matches={matches as any[]} />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max items-start gap-5">
            {rounds.map(([round, roundMatches]) => (
              <section key={round} className="w-[290px] shrink-0">
                <h3 className="mb-3 min-h-5 text-center text-xs font-semibold uppercase text-gray-500">{roundLabel(round)}</h3>
                <div className="space-y-4">
                  {roundMatches.map(match => <PublicMatchCard key={match.id} match={match} compact />)}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <KnockoutResultsTable result={knockoutStandings} />
    </div>
  )
}

function formatLabel(format?: string | null) {
  if (format === 'DOUBLE_ELIMINATION') return 'Dviejų minusų sistema'
  if (format === 'LUCKY_LOSER') return 'Lucky Loser sistema'
  if (format === 'ROUND_ROBIN') return 'Finalinė grupė'
  return 'Vieno minuso sistema'
}
