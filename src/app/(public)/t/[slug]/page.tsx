import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PublicMatchCard from '@/components/public/PublicMatchCard'
import { filterRealMatches } from '@/lib/tournament/realMatches'
import { knockoutFormatLabel, pointSystemInfo, qualificationInfo, setFormatLabel } from '@/lib/tournament/ruleLabels'

export const dynamic = 'force-dynamic'

export default async function PublicTournamentPage({ params }: { params: { slug: string } }) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: params.slug },
    include: {
      config: true,
      _count: { select: { teams: true, groups: true, matches: true } },
    },
  })
  if (!tournament) notFound()

  const matches = await prisma.match.findMany({
    where: { tournamentId: params.slug },
    include: {
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      group: true,
      sets: { orderBy: { setNumber: 'asc' } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { matchOrder: 'asc' }, { matchNumber: 'asc' }],
  })

  const visibleMatches = filterRealMatches(matches)
  const now = new Date()
  const live = visibleMatches.filter(match => match.status === 'IN_PROGRESS')
  const upcoming = visibleMatches
    .filter(match => match.status === 'SCHEDULED' && match.homeTeamId && match.awayTeamId)
    .sort((a, b) => {
      const at = a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER
      const bt = b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER
      return at - bt
    })
    .slice(0, 4)
  const recent = visibleMatches
    .filter(match => match.status === 'FINISHED')
    .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))
    .slice(0, 4)
  const finishedCount = visibleMatches.filter(match => match.status === 'FINISHED').length
  const config = tournament.config
  const pointSystem = pointSystemInfo(config?.groupPointSystem)
  const qualification = qualificationInfo({
    advanceMode: config?.advanceMode,
    advancePerGroup: config?.advancePerGroup,
    advanceTotal: config?.advanceTotal,
    numGroups: config?.numGroups ?? tournament._count.groups,
  })

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { value: tournament._count.teams, label: 'Komandų' },
          { value: tournament._count.groups, label: 'Grupių' },
          { value: finishedCount, label: 'Baigta' },
          { value: live.length, label: 'Vyksta' },
        ].map(item => (
          <div key={item.label} className="border border-gray-200 bg-white p-4 text-center rounded-lg">
            <div className="text-2xl font-semibold text-gray-950">{item.value}</div>
            <div className="mt-1 text-xs font-medium uppercase text-gray-400">{item.label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RulesPanel
          title="Grupių etapas"
          rows={[
            { label: 'Setų formatas', value: setFormatLabel(config?.groupSetFormat) },
            { label: 'Tie-break', value: `Iki ${config?.groupTiebreakPoints ?? 15} taškų` },
            { label: 'Taškų sistema', value: pointSystem.label, detail: pointSystem.explanation },
            { label: 'Patenka į atkrintamąsias', value: `${qualification.count} komandų`, detail: qualification.explanation },
          ]}
        />
        <RulesPanel
          title="Atkrintamosios"
          rows={[
            { label: 'Sistema', value: knockoutFormatLabel(config?.knockoutFormat) },
            { label: 'Setų formatas', value: setFormatLabel(config?.knockoutSetFormat) },
            { label: 'Tie-break', value: `Iki ${config?.knockoutTiebreakPoints ?? 15} taškų` },
          ]}
        />
      </section>

      {live.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <h2 className="text-sm font-semibold uppercase text-gray-700">Vyksta dabar</h2>
          </div>
          <div className="space-y-3">{live.map(match => <PublicMatchCard key={match.id} match={match} />)}</div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-950">Artimiausios rungtynės</h2>
          <span className="text-xs text-gray-400">{now.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {upcoming.length ? (
          <div className="space-y-3">{upcoming.map(match => <PublicMatchCard key={match.id} match={match} />)}</div>
        ) : (
          <EmptyState text="Artimiausių suplanuotų rungtynių nėra" />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-950">Naujausi rezultatai</h2>
        {recent.length ? (
          <div className="space-y-3">{recent.map(match => <PublicMatchCard key={match.id} match={match} />)}</div>
        ) : (
          <EmptyState text="Rezultatų dar nėra" />
        )}
      </section>
    </div>
  )
}

function RulesPanel({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: string; detail?: string }>
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">{title}</h2>
      <dl className="divide-y divide-gray-100">
        {rows.map(row => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:gap-4">
            <dt className="text-xs font-medium text-gray-500">{row.label}</dt>
            <dd>
              <div className="text-sm font-medium text-gray-900">{row.value}</div>
              {row.detail && <p className="mt-1 text-xs leading-5 text-gray-500">{row.detail}</p>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-400">{text}</div>
}
