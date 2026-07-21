import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/admin/PrintButton'
import { prisma } from '@/lib/prisma'
import { buildLuckyLoserPlan, getQualifiedTeams } from '@/lib/bracket'
import { groupAdvanceCounts } from '@/lib/tournament/qualification'
import { filterRealMatches } from '@/lib/tournament/realMatches'
import { buildKnockoutStandings } from '@/lib/tournament/knockoutStandings'
import { knockoutFormatLabel, pointSystemInfo, setFormatLabel } from '@/lib/tournament/ruleLabels'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Ruošiamas',
  OPEN: 'Registracija',
  CLOSED: 'Registracija uždaryta',
  GROUPS: 'Grupių etapas',
  KNOCKOUT: 'Atkrintamosios',
  FINISHED: 'Baigtas',
}

const CATEGORY_LABEL: Record<string, string> = { M: 'Vyrai', W: 'Moterys', X: 'Mix' }
const DRAW_LABEL: Record<string, string> = {
  RANDOM: 'Atsitiktinis',
  SEEDED_RANDOM: 'Sėjamosios + burtai',
  SNAKE: 'Serpentinas',
  MANUAL: 'Rankinis',
}

const ROUND_LABEL: Record<string, string> = {
  LL: 'Lucky Loser',
  R64: '1/32',
  R32: '1/16',
  R16: '1/8',
  QF: 'Ketvirtfinaliai',
  SF: 'Pusfinaliai',
  F: 'Finalas',
  GF: 'Grand finalas',
  '3rd': 'Dėl 3 vietos',
  'LB-R1': 'Pralaimėtojų 1 etapas',
  'LB-R2': 'Pralaimėtojų 2 etapas',
  'LB-R3': 'Pralaimėtojų 3 etapas',
  'LB-R4': 'Pralaimėtojų 4 etapas',
  'LB-SF': 'Pralaimėtojų pusfinalis',
  'LB-F': 'Pralaimėtojų finalas',
}

const dateFmt = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'Europe/Vilnius',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const timeFmt = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'Europe/Vilnius',
  hour: '2-digit',
  minute: '2-digit',
})

function ratio(won: number, lost: number) {
  if (lost > 0) return won / lost
  return won > 0 ? Number.POSITIVE_INFINITY : 0
}

function formatRatio(value: number) {
  if (value === Number.POSITIVE_INFINITY) return '∞'
  if (!value) return '—'
  return value.toFixed(3)
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return '—'
  return `${dateFmt.format(date)} ${timeFmt.format(date)}`
}

function formatMatchScore(match: { homeSets: number | null; awaySets: number | null }) {
  if (match.homeSets == null || match.awaySets == null) return '—'
  return `${match.homeSets}:${match.awaySets}`
}

function formatSets(sets: Array<{ homeScore: number; awayScore: number }>) {
  if (!sets.length) return '—'
  return sets.map(set => `${set.homeScore}:${set.awayScore}`).join(', ')
}

function roundLabel(round: string | null | undefined) {
  return ROUND_LABEL[round ?? ''] ?? round ?? '—'
}

function teamLabel(entry: any) {
  if (!entry) return '—'
  return entry.team?.name ?? '—'
}

function playerNames(players: Array<{ firstName: string | null; shirtSize: string | null }>) {
  if (!players.length) return '—'
  return players
    .slice(0, 2)
    .map(player => `${player.firstName ?? '—'}${player.shirtSize ? ` (${player.shirtSize})` : ''}`)
    .join(' / ')
}

function groupRowRatio(row: any) {
  return {
    setRatio: ratio(row.groupSetsWon, row.groupSetsLost),
    pointRatio: ratio(row.groupPtsWon, row.groupPtsLost),
    pointDiff: row.groupPtsWon - row.groupPtsLost,
  }
}

export default async function TournamentReportPrintPage({ params }: { params: { id: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { config: true },
  })
  if (!tournament) notFound()

  const [teams, groups, allMatches] = await Promise.all([
    prisma.tournamentTeam.findMany({
      where: { tournamentId: params.id },
      include: {
        group: true,
        team: { include: { players: { orderBy: { playerOrder: 'asc' } } } },
      },
      orderBy: [{ seeded: 'desc' }, { seedRank: 'asc' }, { registeredAt: 'asc' }],
    }),
    prisma.group.findMany({
      where: { tournamentId: params.id },
      orderBy: { order: 'asc' },
      include: {
        teams: {
          include: {
            team: { include: { players: { orderBy: { playerOrder: 'asc' } } } },
          },
          orderBy: [{ groupPoints: 'desc' }, { groupWins: 'desc' }],
        },
        matches: {
          include: {
            sets: { orderBy: { setNumber: 'asc' } },
            homeTeam: { include: { team: true } },
            awayTeam: { include: { team: true } },
          },
          orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }, { matchNumber: 'asc' }],
        },
      },
    }),
    prisma.match.findMany({
      where: { tournamentId: params.id },
      include: {
        group: true,
        sets: { orderBy: { setNumber: 'asc' } },
        homeTeam: { include: { team: true } },
        awayTeam: { include: { team: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { matchOrder: 'asc' }, { matchNumber: 'asc' }],
    }),
  ])

  const cfg = tournament.config
  const realMatches = filterRealMatches(allMatches)
  const groupMatches = realMatches.filter(match => match.groupId)
  const knockoutMatches = realMatches.filter(match => !match.groupId)
  const finishedMatches = realMatches.filter(match => match.status === 'FINISHED')

  const advanceCounts = groupAdvanceCounts(
    cfg ?? {},
    groups.length,
    groups.map(group => group.maxTeams),
  )
  const groupsForBracket = groups.map((group, index) => ({
    ...group,
    advanceCount: advanceCounts[index] ?? group.advanceCount ?? cfg?.advancePerGroup ?? 2,
  }))
  const qualified = cfg?.knockoutFormat === 'LUCKY_LOSER'
    ? (() => {
        const plan = buildLuckyLoserPlan(groupsForBracket as any, cfg as any)
        return [...plan.direct, ...plan.llSorted]
      })()
    : getQualifiedTeams(
        groupsForBracket as any,
        cfg?.advanceMode === 'total' ? cfg.advanceTotal ?? undefined : undefined,
        cfg?.groupPointSystem,
      )

  const teamByTournamentTeamId = new Map(teams.map(team => [team.id, team]))
  const qualifiedRows = qualified.flatMap((entry, index) => {
    const team = teamByTournamentTeamId.get(entry.tournamentTeamId)
    if (!team) return []
    return {
      seed: entry.seed ?? index + 1,
      fromGroup: entry.fromGroup ?? team.group?.name ?? '—',
      fromPosition: entry.fromPosition ?? 0,
      team,
    }
  })

  const knockoutStandings = buildKnockoutStandings(
    qualifiedRows.map(row => ({
      id: row.team.id,
      name: row.team.team.name,
      club: row.team.team.club,
      seed: row.seed,
    })),
    knockoutMatches.map(match => ({
      id: match.id,
      round: match.round,
      matchOrder: match.matchOrder,
      matchNumber: match.matchNumber,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      winnerId: match.winnerId,
      homeSets: match.homeSets,
      awaySets: match.awaySets,
      sets: match.sets,
    })),
    cfg?.knockoutFormat,
  )

  const medalists = knockoutStandings.rows.filter(row => ['1', '2', '3'].includes(row.place))
  const pointSystem = pointSystemInfo(cfg?.groupPointSystem)

  return (
    <main className="min-h-screen bg-white text-gray-950 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .report-section { break-inside: avoid; }
          .page-break { break-before: page; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href={`/tournament/${params.id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Grįžti į turnyrą
        </Link>
        <PrintButton>Išsaugoti / spausdinti PDF</PrintButton>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-6 pb-10 print:max-w-none print:space-y-4 print:p-0">
        <header className="border-b border-gray-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Turnyro ataskaita</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950">{tournament.name}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {dateFmt.format(tournament.startsAt)}
            {tournament.location ? ` · ${tournament.location}` : ''}
            {tournament.organizer ? ` · Organizatorius: ${tournament.organizer}` : ''}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Statusas: {STATUS_LABEL[tournament.status]} · Kategorija: {CATEGORY_LABEL[tournament.category] ?? tournament.category}
          </p>
        </header>

        <section className="report-section grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Komandų" value={teams.length} />
          <SummaryCard label="Grupių" value={groups.length} />
          <SummaryCard label="Sužaista mačų" value={finishedMatches.length} />
          <SummaryCard label="Atkrintamųjų komandų" value={qualifiedRows.length} />
        </section>

        <section className="report-section rounded-xl border border-gray-200">
          <SectionHeader title="Apibendrinimas" />
          <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
            <InfoList rows={[
              ['Viso rungtynių', String(realMatches.length)],
              ['Grupių rungtynės', `${groupMatches.filter(match => match.status === 'FINISHED').length}/${groupMatches.length}`],
              ['Atkrintamųjų rungtynės', `${knockoutMatches.filter(match => match.status === 'FINISHED').length}/${knockoutMatches.length}`],
              ['Prizininkai', medalists.length ? medalists.map(row => `${row.place}. ${row.name}`).join(' · ') : 'Dar nenustatyta'],
            ]} />
            <InfoList rows={[
              ['Grupių formatas', setFormatLabel(cfg?.groupSetFormat)],
              ['Grupių tiebreak', `${cfg?.groupTiebreakPoints ?? '—'} t.`],
              ['Laimėjimo sistema', pointSystem.label],
              ['Atkrintamųjų sistema', knockoutFormatLabel(cfg?.knockoutFormat)],
              ['KO formatas', setFormatLabel(cfg?.knockoutSetFormat)],
              ['KO tiebreak', `${cfg?.knockoutTiebreakPoints ?? '—'} t.`],
              ['Dėl 3 vietos', cfg?.thirdPlaceMatch ? 'Taip' : 'Ne'],
              ['Burtų metodas', DRAW_LABEL[cfg?.drawMethod ?? ''] ?? '—'],
            ]} />
          </div>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">{pointSystem.explanation}</p>
        </section>

        <section className="report-section rounded-xl border border-gray-200">
          <SectionHeader title="Komandų sąrašas" subtitle={`${teams.length} komandų`} />
          <Table>
            <thead>
              <tr>
                <Th>#</Th><Th>Komanda</Th><Th>Klubas</Th><Th>Amžius</Th><Th>Sėj.</Th><Th>Žaidėjai</Th><Th>Grupė</Th>
              </tr>
            </thead>
            <tbody>
              {teams.map((entry, index) => (
                <tr key={entry.id} className="border-t border-gray-100">
                  <Td>{index + 1}</Td>
                  <Td strong>{entry.team.name}</Td>
                  <Td>{entry.team.club ?? '—'}</Td>
                  <Td>{entry.team.teamAge ?? '—'}</Td>
                  <Td>{entry.seeded ? `S${entry.seedRank ?? ''}` : '—'}</Td>
                  <Td>{playerNames(entry.team.players)}</Td>
                  <Td>{entry.group?.name ? `Gr. ${entry.group.name}` : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="page-break space-y-4">
          <h2 className="text-xl font-bold text-gray-950">Grupių sudėtis ir rezultatai</h2>
          {groups.map(group => (
            <div key={group.id} className="report-section rounded-xl border border-gray-200">
              <SectionHeader title={`Grupė ${group.name}`} subtitle={`${group.teams.length} komandų · patenka ${group.advanceCount}`} />
              <Table>
                <thead>
                  <tr>
                    <Th>Vieta</Th><Th>Komanda</Th><Th>L/P</Th><Th>T</Th><Th>Setai</Th><Th>S. sant.</Th><Th>Taškai</Th><Th>T. sant.</Th><Th>+/-</Th>
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map((entry, index) => {
                    const ratios = groupRowRatio(entry)
                    return (
                      <tr key={entry.id} className="border-t border-gray-100">
                        <Td>{index + 1}</Td>
                        <Td strong>{entry.team.name}</Td>
                        <Td>{entry.groupWins}/{entry.groupLosses}</Td>
                        <Td strong>{entry.groupPoints}</Td>
                        <Td>{entry.groupSetsWon}:{entry.groupSetsLost}</Td>
                        <Td>{formatRatio(ratios.setRatio)}</Td>
                        <Td>{entry.groupPtsWon}:{entry.groupPtsLost}</Td>
                        <Td>{formatRatio(ratios.pointRatio)}</Td>
                        <Td>{ratios.pointDiff > 0 ? '+' : ''}{ratios.pointDiff}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
              <MatchList matches={group.matches} />
            </div>
          ))}
        </section>

        <section className="page-break report-section rounded-xl border border-gray-200">
          <SectionHeader title="Atkrintamųjų komandos pagal reitingą" subtitle={`${qualifiedRows.length} komandų`} />
          <Table>
            <thead>
              <tr>
                <Th>Reit.</Th><Th>Komanda</Th><Th>Klubas</Th><Th>Grupė · vieta</Th><Th>Grupių T</Th><Th>L/P</Th><Th>Setai</Th><Th>Taškai</Th>
              </tr>
            </thead>
            <tbody>
              {qualifiedRows.map(row => (
                <tr key={row.team.id} className="border-t border-gray-100">
                  <Td strong>{row.seed}</Td>
                  <Td strong>{row.team.team.name}</Td>
                  <Td>{row.team.team.club ?? '—'}</Td>
                  <Td>Gr. {row.fromGroup} · {row.fromPosition} vieta</Td>
                  <Td strong>{row.team.groupPoints}</Td>
                  <Td>{row.team.groupWins}/{row.team.groupLosses}</Td>
                  <Td>{row.team.groupSetsWon}:{row.team.groupSetsLost}</Td>
                  <Td>{row.team.groupPtsWon}:{row.team.groupPtsLost}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="report-section rounded-xl border border-gray-200">
          <SectionHeader title="Atkrintamųjų rezultatai" subtitle={`${knockoutMatches.filter(match => match.status === 'FINISHED').length}/${knockoutMatches.length} baigta`} />
          <Table>
            <thead>
              <tr>
                <Th>#</Th><Th>Etapas</Th><Th>Laikas</Th><Th>Aikšt.</Th><Th>Komandos</Th><Th>Rez.</Th><Th>Setai</Th><Th>Nugalėtojas</Th>
              </tr>
            </thead>
            <tbody>
              {knockoutMatches.map(match => (
                <tr key={match.id} className="border-t border-gray-100">
                  <Td>{match.matchOrder ?? match.matchNumber ?? '—'}</Td>
                  <Td>{roundLabel(match.round)}</Td>
                  <Td>{formatDateTime(match.scheduledAt)}</Td>
                  <Td>{match.court ? `A.${match.court}` : '—'}</Td>
                  <Td>{teamLabel(match.homeTeam)} / {teamLabel(match.awayTeam)}</Td>
                  <Td strong>{formatMatchScore(match)}</Td>
                  <Td>{formatSets(match.sets)}</Td>
                  <Td>{match.winnerId ? teamLabel(match.winnerId === match.homeTeamId ? match.homeTeam : match.awayTeam) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="report-section rounded-xl border border-gray-200">
          <SectionHeader title="Atkrintamųjų statistika" subtitle={knockoutStandings.complete ? 'Galutinė rikiuotė' : 'Tarpinė rikiuotė'} />
          <Table>
            <thead>
              <tr>
                <Th>Vieta</Th><Th>Sėj.</Th><Th>Komanda</Th><Th>Rezultatas</Th><Th>R</Th><Th>L/P</Th><Th>Setai</Th><Th>S. sant.</Th><Th>Taškai</Th><Th>T. sant.</Th><Th>+/-</Th>
              </tr>
            </thead>
            <tbody>
              {knockoutStandings.rows.map(row => (
                <tr key={row.id} className="border-t border-gray-100">
                  <Td strong>{row.place}</Td>
                  <Td>{row.seed ? `#${row.seed}` : '—'}</Td>
                  <Td strong>{row.name}{row.club ? <span className="ml-1 font-normal text-gray-400">{row.club}</span> : null}</Td>
                  <Td>{row.statusLabel}</Td>
                  <Td>{row.played}</Td>
                  <Td>{row.wins}/{row.losses}</Td>
                  <Td>{row.setsWon}:{row.setsLost}</Td>
                  <Td>{formatRatio(row.setRatio)}</Td>
                  <Td>{row.pointsWon}:{row.pointsLost}</Td>
                  <Td>{formatRatio(row.pointRatio)}</Td>
                  <Td>{row.pointDiff > 0 ? '+' : ''}{row.pointDiff}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl font-bold text-gray-950">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
    </div>
  )
}

function InfoList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[150px_1fr] gap-3">
          <dt className="text-gray-400">{label}</dt>
          <dd className="font-medium text-gray-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-xs">{children}</table>
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold text-gray-400">{children}</th>
}

function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <td className={`px-3 py-2 align-top text-gray-600 ${strong ? 'font-semibold text-gray-900' : ''}`}>{children}</td>
}

function MatchList({ matches }: { matches: any[] }) {
  if (!matches.length) return null
  return (
    <div className="border-t border-gray-100 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Grupės rungtynės</h3>
      <div className="grid gap-1 text-xs text-gray-600 md:grid-cols-2">
        {matches.map(match => (
          <div key={match.id} className="flex justify-between gap-3 rounded bg-gray-50 px-2 py-1">
            <span>
              #{match.matchNumber ?? '—'} · {teamLabel(match.homeTeam)} - {teamLabel(match.awayTeam)}
            </span>
            <span className="font-medium">
              {formatMatchScore(match)} · {formatSets(match.sets)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
