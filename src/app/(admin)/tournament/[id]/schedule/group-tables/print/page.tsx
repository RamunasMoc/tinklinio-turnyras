import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PrintButton from '@/components/admin/PrintButton'

export const dynamic = 'force-dynamic'

type TeamEntry = {
  id: string
  registeredAt: Date
  seedRank: number | null
  seeded: boolean
  team: {
    name: string
    club: string | null
  }
}

type GroupEntry = {
  id: string
  name: string
  order: number
  teams: TeamEntry[]
  matches: Array<{
    id: string
    matchNumber: number | null
    scheduledAt: Date | null
    court: number | null
    homeTeamId: string | null
    awayTeamId: string | null
  }>
}

const timeFmt = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'Europe/Vilnius',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFmt = new Intl.DateTimeFormat('lt-LT', {
  timeZone: 'Europe/Vilnius',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export default async function PrintGroupTablesPage({ params }: { params: { id: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { config: true },
  })
  if (!tournament) notFound()

  const groups = await prisma.group.findMany({
    where: { tournamentId: params.id },
    orderBy: { order: 'asc' },
    include: {
      teams: {
        include: { team: true },
        orderBy: [{ seeded: 'desc' }, { seedRank: 'asc' }, { registeredAt: 'asc' }],
      },
      matches: {
        where: {
          homeTeamId: { not: null },
          awayTeamId: { not: null },
        },
        orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }, { matchNumber: 'asc' }],
      },
    },
  })

  return (
    <main className="min-h-screen bg-white text-gray-950 print:bg-white">
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          .group-sheet {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
          .group-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href={`/tournament/${params.id}/schedule`} className="text-sm text-gray-500 hover:text-gray-900">
          Grįžti į tvarkaraštį
        </Link>
        <PrintButton />
      </div>

      {groups.length === 0 ? (
        <section className="mx-auto mt-12 max-w-3xl rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          Grupės dar nesudarytos.
        </section>
      ) : (
        <div className="mx-auto max-w-6xl space-y-6 px-6 pb-8 print:max-w-none print:space-y-0 print:p-0">
          {(groups as GroupEntry[]).map(group => (
            <GroupSheet key={group.id} tournament={tournament} group={group} />
          ))}
        </div>
      )}
    </main>
  )
}

function GroupSheet({ tournament, group }: { tournament: any; group: GroupEntry }) {
  const teams = group.teams
  const teamNumberById = new Map(teams.map((entry, index) => [entry.id, index + 1]))
  const pairSequence = group.matches
    .map(match => {
      const homeNumber = match.homeTeamId ? teamNumberById.get(match.homeTeamId) : null
      const awayNumber = match.awayTeamId ? teamNumberById.get(match.awayTeamId) : null
      if (!homeNumber || !awayNumber) return null
      return {
        label: `${homeNumber}-${awayNumber}`,
        match,
      }
    })
    .filter(Boolean) as Array<{
    label: string
    match: GroupEntry['matches'][number]
  }>

  return (
    <section className="group-sheet min-h-[194mm] rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:rounded-none print:p-0">
      <header className="mb-3 text-center">
        <h1 className="text-xl font-bold">
          {tournament.name}. Grupė Nr. {group.name}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {dateFmt.format(tournament.startsAt)}
          {tournament.location ? ` · ${tournament.location}` : ''}
        </p>
      </header>

      <table className="w-full table-fixed border-collapse text-[10px]">
        <thead>
          <tr>
            <CornerCell />
            {teams.map((entry, index) => (
              <HeaderCell key={entry.id} index={index + 1} name={entry.team.name} />
            ))}
            <th className="w-[9%] border-2 border-gray-950 bg-white px-1 py-2 text-center text-sm font-black uppercase">
              Taškai
            </th>
            <th className="w-[8%] border-2 border-gray-950 bg-white px-1 py-2 text-center text-sm font-black uppercase">
              Vieta
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((entry, rowIndex) => (
            <tr key={entry.id}>
              <RowHeader index={rowIndex + 1} name={entry.team.name} club={entry.team.club} />
              {teams.map((opponent, colIndex) => (
                <ResultCell key={opponent.id} isSelf={rowIndex === colIndex} />
              ))}
              <td className="border-2 border-gray-950 bg-white" />
              <td className="border-2 border-gray-950 bg-white" />
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="mt-4">
        <div className="text-center text-base font-black tracking-wide">
          {pairSequence.length > 0 ? pairSequence.map(pair => pair.label).join(', ') : 'Tvarkaraštis dar nesugeneruotas'}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-[10px] text-gray-500">
          <div>Rungtynių: {pairSequence.length}</div>
          <div className="text-center">
            {pairSequence.some(pair => pair.match.scheduledAt)
              ? `Pirma rungt.: ${formatFirstMatch(pairSequence)}`
              : 'Laikai nepaskirti'}
          </div>
          <div className="text-right">Atspausdinta: {timeFmt.format(new Date())}</div>
        </div>
      </footer>
    </section>
  )
}

function CornerCell() {
  return <th className="w-[9%] border-2 border-gray-950 bg-gray-50" />
}

function HeaderCell({ index, name }: { index: number; name: string }) {
  return (
    <th className="border-2 border-gray-950 bg-white px-1 py-2 text-left align-top">
      <div className="text-sm font-black">{index} Komanda</div>
      <div className="mt-1 line-clamp-2 text-[9px] font-semibold leading-tight text-gray-700">{name}</div>
    </th>
  )
}

function RowHeader({ index, name, club }: { index: number; name: string; club: string | null }) {
  return (
    <th className="border-2 border-gray-950 bg-white px-2 py-2 text-left align-top">
      <div className="text-sm font-black">{index} Komanda</div>
      <div className="mt-2 text-[10px] font-semibold leading-tight">{name}</div>
      {club && <div className="mt-1 text-[9px] font-normal text-gray-500">{club}</div>}
    </th>
  )
}

function ResultCell({ isSelf }: { isSelf: boolean }) {
  if (isSelf) return <td className="h-14 border border-gray-950 bg-gray-100" />
  return (
    <td className="h-14 border border-gray-950 bg-white text-center align-middle">
      <span className="inline-block text-sm font-bold tracking-wider">------------</span>
    </td>
  )
}

function formatFirstMatch(
  pairs: Array<{
    label: string
    match: GroupEntry['matches'][number]
  }>,
) {
  const first = pairs.find(pair => pair.match.scheduledAt)
  if (!first?.match.scheduledAt) return 'Laikai nepaskirti'
  const court = first.match.court ? ` · A.${first.match.court}` : ''
  return `${timeFmt.format(first.match.scheduledAt)}${court}`
}
