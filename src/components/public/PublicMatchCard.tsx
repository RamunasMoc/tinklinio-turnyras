import { roundLabel } from '@/lib/publicTournament'

export default function PublicMatchCard({ match, compact = false }: { match: any; compact?: boolean }) {
  const finished = match.status === 'FINISHED'
  const live = match.status === 'IN_PROGRESS'
  const homeWinner = finished && match.winnerId === match.homeTeamId
  const awayWinner = finished && match.winnerId === match.awayTeamId
  const setScores = (match.sets ?? [])
    .filter((set: any) => set.homeScore !== 0 || set.awayScore !== 0)
    .map((set: any) => `${set.homeScore}:${set.awayScore}`)
    .join('  ')
  const calculatedHomeSets = (match.sets ?? []).filter((set: any) => set.homeScore > set.awayScore).length
  const calculatedAwaySets = (match.sets ?? []).filter((set: any) => set.awayScore > set.homeScore).length
  const hasSetResults = calculatedHomeSets + calculatedAwaySets > 0
  const homeSets = hasSetResults ? calculatedHomeSets : (match.homeSets ?? 0)
  const awaySets = hasSetResults ? calculatedAwaySets : (match.awaySets ?? 0)
  const time = match.scheduledAt
    ? new Date(match.scheduledAt).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
    : 'Laikas nepaskirtas'

  return (
    <article className={`overflow-hidden rounded-lg border bg-white ${live ? 'border-red-300' : finished ? 'border-green-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <div className="min-w-0 truncate">
          {match.group ? `Grupė ${match.group.name}` : roundLabel(match.round)}
          {match.matchOrder || match.matchNumber ? ` · #${match.matchOrder ?? match.matchNumber}` : ''}
        </div>
        <div className="shrink-0 font-medium">
          {match.court ? `A.${match.court} · ` : ''}{time}
        </div>
      </div>
      <div className={compact ? 'px-3 py-2' : 'px-3 py-3'}>
        <TeamRow name={match.homeTeam?.team?.name} winner={homeWinner} score={finished ? homeSets : null} />
        <TeamRow name={match.awayTeam?.team?.name} winner={awayWinner} score={finished ? awaySets : null} />
        <div className="mt-2 flex min-h-4 items-center justify-between gap-3 text-xs">
          <span className="font-mono text-gray-400">{setScores}</span>
          {live && <span className="font-semibold text-red-600">VYKSTA</span>}
          {finished && <span className="font-medium text-green-700">Baigta</span>}
          {!live && !finished && <span className="text-gray-400">Planuojama</span>}
        </div>
      </div>
    </article>
  )
}

function TeamRow({ name, winner, score }: { name?: string | null; winner: boolean; score: number | null }) {
  return (
    <div className={`flex min-h-8 items-center justify-between gap-3 px-2 py-1 text-sm ${winner ? 'bg-green-50 font-semibold text-green-800' : name ? 'text-gray-700' : 'italic text-gray-400'}`}>
      <span className="min-w-0 truncate">{name ?? 'Laukiama komandos'}</span>
      {score !== null && <span className={`shrink-0 text-lg font-semibold ${winner ? 'text-green-700' : 'text-gray-400'}`}>{score}</span>}
    </div>
  )
}
