import { notFound }      from 'next/navigation'
import { prisma }        from '@/lib/prisma'
import { MatchStatus }   from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'
import TournamentActions    from '@/components/admin/TournamentActions'
import TournamentEditClient from '@/components/admin/TournamentEditClient'

const STATUS_LABEL: Record<string,string> = {
  DRAFT:'Ruošiamas', OPEN:'Registracija', CLOSED:'Uždaryta',
  GROUPS:'Grupių etapas', KNOCKOUT:'Atkrintamosios', FINISHED:'Baigtas',
}
const CAT_LABEL: Record<string,string> = { M:'♂ Vyrai', W:'♀ Moterys', X:'⚥ Mix' }
const FMT_LABEL: Record<string,string> = {
  BO2_21:'Best of 2 · iki 21', BO2_15:'Best of 2 · iki 15',
  ONE_21:'1 setas · iki 21',   ONE_15:'1 setas · iki 15',
}
const KO_LABEL: Record<string,string> = {
  SINGLE_ELIMINATION:'Single elimination',
  LUCKY_LOSER:'FIVB Lucky Loser',
  DOUBLE_ELIMINATION:'Double elimination',
  ROUND_ROBIN:'Apskritasis',
}
function realKOMatches(matches: any[]) {
  const hasWBFinal = matches.some(m => m.round === 'F')
  const hasLBFinal = matches.some(m => m.round === 'LB-F')
  const loserSourceCount = (matchNumber: number | null) => {
    const firstRound = matches.some(m => m.round === 'R16') ? 'R16' : 'QF'
    return [(matchNumber ?? 1) * 2 - 1, (matchNumber ?? 1) * 2].filter(n => {
      const source = matches.find(m => m.round === firstRound && m.matchNumber === n)
      return source?.homeTeamId && source?.awayTeamId
    }).length
  }
  return matches.filter(m => {
    if (m.status === MatchStatus.FINISHED && (!m.homeTeamId || !m.awayTeamId)) return false
    if (m.round === 'LB-R1' && loserSourceCount(m.matchNumber ?? null) < 2) return false
    if (m.round === 'LB-R2' && loserSourceCount(m.matchNumber ?? null) === 0) return false
    if (!hasWBFinal && !hasLBFinal && m.round === 'LB-SF' && (m.matchNumber ?? 1) > 1) return false
    return true
  })
}

export const dynamic = 'force-dynamic'

export default async function TournamentPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const t = await prisma.tournament.findUnique({
    where:   { id: params.id },
    include: { config: true, _count: { select: { teams: true, groups: true, matches: true } } },
  })
  if (!t) notFound()

  const cfg         = t.config
  const groupDone   = await prisma.match.count({ where: { tournamentId: t.id, status:'FINISHED', groupId: { not: null } } })
  const groupTotal  = await prisma.match.count({ where: { tournamentId: t.id, groupId: { not: null } } })
  const koMatches   = realKOMatches(await prisma.match.findMany({
    where: { tournamentId: t.id, groupId: null },
    select: { id: true, status: true, scheduledAt: true, homeTeamId: true, awayTeamId: true, round: true, matchNumber: true },
  }))
  const koDone      = koMatches.filter(m => m.status === MatchStatus.FINISHED).length
  const koTotal     = koMatches.length

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
        <a href="/dashboard">Turnyrai</a><span>/</span>
        <span className="text-gray-700">{t.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-semibold text-gray-900">{t.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              {t.location && <span>📍 {t.location}</span>}
              <span>📅 {t.startsAt.toLocaleDateString('lt-LT', { dateStyle:'long' })}</span>
              <span>{CAT_LABEL[t.category]}</span>
              {t.organizer && <span>👤 {t.organizer}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {isAdmin && (
              <a
                href={`/tournament/${t.id}/report/print`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Ataskaita ↗
              </a>
            )}
            <a
              href={`/t/${t.id}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Stebėtojo vaizdas ↗
            </a>
            {isAdmin && <TournamentEditClient tournament={t} />}
            {isAdmin && <TournamentActions id={t.id} status={t.status} />}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          {[
            { v: t._count.teams,  l: 'komandų' },
            { v: t._count.groups, l: 'grupių' },
            { v: groupDone,       l: 'grupių baigta' },
            { v: koDone,          l: 'KO baigta' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-2xl font-semibold text-gray-900">{s.v}</div>
              <div className="text-xs text-gray-400">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grupių etapas */}
      <div className="mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Grupių etapas</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href:'teams',    icon:'👥', label:'Komandos',       sub:`${t._count.teams} registruota` },
            { href:'groups',   icon:'🎯', label:'Grupės ir burtai', sub: t._count.groups > 0 ? `${t._count.groups} grupių suformuota` : cfg ? `${cfg.numGroups} grupių (nesuformuota)` : 'Nekonfigūruota' },
            { href:'schedule', icon:'📅', label:'Tvarkaraštis',   sub:`${groupTotal} rungtynių`, badge: groupDone < groupTotal && groupTotal > 0 ? `${groupDone}/${groupTotal}` : undefined },
            { href:'results',  icon:'✏️', label:'Rezultatai',     sub:`${groupDone} baigta`, badge: groupDone < groupTotal && groupTotal > 0 ? `${groupTotal - groupDone} liko` : undefined },
            { href:'standings', icon:'📊', label:'Grupių lentelė',   sub:'Statistika ir reitingai' },
          ].map(item => (
            <a key={item.href} href={`/tournament/${t.id}/${item.href}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all relative">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="font-medium text-sm text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
              {item.badge && (
                <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Atkrintamosios */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Atkrintamosios</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href:'knockout',          icon:'🏆', label:'Braket ir generavimas', sub: KO_LABEL[cfg?.knockoutFormat ?? ''] ?? '—' },
            { href:'knockout-schedule', icon:'📅', label:'KO tvarkaraštis',       sub:`${koTotal} rungtynių` },
            { href:'knockout-results',  icon:'✏️', label:'KO rezultatai',         sub:`${koDone} baigta` },
          ].map(item => (
            <a key={item.href} href={`/tournament/${t.id}/${item.href}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="font-medium text-sm text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{item.sub}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Konfigūracija */}
      {cfg && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Konfigūracija</h2>
            {isAdmin && (
              <a href={`/tournament/${t.id}/config`} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Keisti →
              </a>
            )}
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {[
              ['Grupių sk.',      cfg.numGroups],
              ['Grupių formatas', FMT_LABEL[cfg.groupSetFormat] ?? cfg.groupSetFormat],
              ['KO sistema',      KO_LABEL[cfg.knockoutFormat]],
              ['KO formatas',     FMT_LABEL[cfg.knockoutSetFormat] ?? cfg.knockoutSetFormat],
              ['Tiebreak iki',    `${cfg.groupTiebreakPoints} t.`],
              ['Dėl 3 vietos',    cfg.thirdPlaceMatch ? 'Taip' : 'Ne'],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-gray-400 text-xs">{k}</dt>
                <dd className="font-medium text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {!cfg && isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 mt-4">
          ⚠️ Konfigūracija nenustatyta.{' '}
          <a href={`/tournament/${t.id}/config`} className="font-medium underline">Nustatyti dabar →</a>
        </div>
      )}
    </div>
  )
}
