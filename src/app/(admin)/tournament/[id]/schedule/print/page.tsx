import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import PrintButton from '@/components/admin/PrintButton'

export const dynamic = 'force-dynamic'

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

type PrintMatch = {
  id: string
  matchNumber: number | null
  court: number | null
  scheduledAt: Date | null
  group: { name: string } | null
  homeTeam: { team: { name: string; club: string | null } } | null
  awayTeam: { team: { name: string; club: string | null } } | null
}

export default async function PrintGroupSchedulePage({ params }: { params: { id: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { config: true },
  })
  if (!tournament) notFound()

  const matches = await prisma.match.findMany({
    where: {
      tournamentId: params.id,
      groupId: { not: null },
      scheduledAt: { not: null },
      court: { not: null },
    },
    include: {
      group: true,
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
    orderBy: [{ court: 'asc' }, { scheduledAt: 'asc' }, { matchNumber: 'asc' }],
  })

  const courts = groupByCourt(matches as PrintMatch[])
  const totalMatches = matches.length

  return (
    <main className="min-h-screen bg-white text-gray-950 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .court-page {
            page-break-after: always;
            break-after: page;
            box-shadow: none !important;
            border: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
          }
          .court-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href={`/tournament/${params.id}/schedule`} className="text-sm text-gray-500 hover:text-gray-900">
          Grįžti į tvarkaraštį
        </Link>
        <PrintButton />
      </div>

      {courts.length === 0 ? (
        <section className="mx-auto mt-12 max-w-3xl rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          Grupių tvarkaraštis dar nesugeneruotas arba rungtynėms nepaskirtos aikštelės.
        </section>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6 px-6 pb-8 print:max-w-none print:space-y-0 print:p-0">
          {courts.map(({ court, matches: courtMatches }) => (
            <section
              key={court}
              className="court-page min-h-[287mm] rounded-xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:p-0"
            >
              <header className="mb-4 border-b-2 border-gray-900 pb-3">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Grupių tvarkaraštis</p>
                    <h1 className="mt-1 text-2xl font-bold">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-gray-600">
                      {dateFmt.format(tournament.startsAt)}
                      {tournament.location ? ` · ${tournament.location}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black">A.{court}</div>
                    <div className="mt-1 text-sm text-gray-500">{courtMatches.length} rungt.</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-gray-700">
                  <Info label="Setai" value={formatSetFormat(tournament.config?.groupSetFormat)} />
                  <Info label="Tie break" value={`${tournament.config?.groupTiebreakPoints ?? 11} t.`} />
                  <Info label="Trukmė" value={`${tournament.config?.groupTimeMinutes ?? 30} min.`} />
                  <Info label="Iš viso" value={`${totalMatches} rungt.`} />
                </div>
              </header>

              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-100 text-gray-600">
                    <Th className="w-12">Laikas</Th>
                    <Th className="w-10">Nr.</Th>
                    <Th className="w-12">Gr.</Th>
                    <Th>Komanda 1</Th>
                    <Th>Komanda 2</Th>
                    <Th className="w-20 text-center">Rez.</Th>
                    <Th className="w-28">Pastabos</Th>
                  </tr>
                </thead>
                <tbody>
                  {courtMatches.map(match => (
                    <tr key={match.id} className="border-b border-gray-200 align-top">
                      <Td className="font-semibold">{match.scheduledAt ? timeFmt.format(match.scheduledAt) : '—'}</Td>
                      <Td>#{match.matchNumber ?? '—'}</Td>
                      <Td>{match.group?.name ?? '—'}</Td>
                      <TeamCell match={match} side="home" />
                      <TeamCell match={match} side="away" />
                      <Td className="text-center">
                        <span className="inline-block min-w-16 rounded border border-gray-300 px-2 py-1 text-gray-400">:</span>
                      </Td>
                      <Td>
                        <span className="block h-6 border-b border-dotted border-gray-300" />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <footer className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-200 pt-3 text-xs text-gray-500">
                <div>Teisėjas: __________________</div>
                <div>Parašas: __________________</div>
                <div className="text-right">Atspausdinta: {timeFmt.format(new Date())}</div>
              </footer>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}

function groupByCourt(matches: PrintMatch[]) {
  const byCourt = new Map<number, PrintMatch[]>()
  for (const match of matches) {
    if (!match.court) continue
    if (!byCourt.has(match.court)) byCourt.set(match.court, [])
    byCourt.get(match.court)!.push(match)
  }

  return Array.from(byCourt.entries())
    .sort(([a], [b]) => a - b)
    .map(([court, courtMatches]) => ({ court, matches: courtMatches }))
}

function formatSetFormat(format?: string | null) {
  if (format === 'BO1_21') return '1 setas iki 21'
  if (format === 'BO2_15') return 'Best of 2 iki 15'
  if (format === 'BO2_21') return 'Best of 2 iki 21'
  return format ?? '—'
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-2 py-2 font-semibold ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2 py-2 ${className}`}>{children}</td>
}

function TeamCell({ match, side }: { match: PrintMatch; side: 'home' | 'away' }) {
  const entry = side === 'home' ? match.homeTeam : match.awayTeam
  return (
    <Td>
      <div className="font-semibold text-gray-950">{entry?.team?.name ?? '—'}</div>
      {entry?.team?.club && <div className="mt-0.5 text-[10px] text-gray-500">{entry.team.club}</div>}
    </Td>
  )
}
