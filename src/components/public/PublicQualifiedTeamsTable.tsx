type QualifiedRow = {
  id: string
  seed: number | null
  group: string | null
  position: number | null
  wildCard: boolean
  team: {
    name: string
    club: string | null
    groupPoints: number
    groupWins: number
    groupLosses: number
    groupSetsWon: number
    groupSetsLost: number
    groupPtsWon: number
    groupPtsLost: number
  }
}

export default function PublicQualifiedTeamsTable({ rows }: { rows: QualifiedRow[] }) {
  if (rows.length === 0) return null

  return (
    <section className="mb-7 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">Patenka į atkrintamąsias</h3>
        <span className="text-xs text-gray-400">{rows.length} komandų</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[44px_minmax(260px,1fr)_130px_70px_85px_100px_105px_85px] items-center border-b border-gray-100 px-3 py-2 text-center text-xs font-medium text-gray-400">
            <span />
            <span className="text-left">Komanda</span>
            <span>Grupė · Vieta</span>
            <span>Taškai</span>
            <span>L/P</span>
            <span>S. sant.</span>
            <span>T. sant.</span>
            <span>T. skirt.</span>
          </div>
          <div className="divide-y divide-gray-100">
            {rows.map((row, index) => {
              const setRatio = ratio(row.team.groupSetsWon, row.team.groupSetsLost)
              const pointRatio = ratio(row.team.groupPtsWon, row.team.groupPtsLost)
              const difference = row.team.groupPtsWon - row.team.groupPtsLost
              return (
                <div key={row.id} className="grid grid-cols-[44px_minmax(260px,1fr)_130px_70px_85px_100px_105px_85px] items-center px-3 py-3 text-center text-sm">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-400 text-white' : index === 1 ? 'bg-gray-300 text-white' : index === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {row.seed ?? index + 1}
                  </span>
                  <div className="min-w-0 text-left">
                    <span className="font-medium text-gray-900">{row.team.name}</span>
                    {row.team.club && <span className="ml-2 text-xs text-gray-400">{row.team.club}</span>}
                    {row.wildCard && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">wild card</span>}
                  </div>
                  <span className="justify-self-center rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">Gr.{row.group} · {row.position} vieta</span>
                  <span className="text-gray-500">{row.team.groupPoints}t.</span>
                  <span className="text-gray-500">{row.team.groupWins}L/{row.team.groupLosses}P</span>
                  <span className="text-xs text-gray-500">{setRatio} ({row.team.groupSetsWon}/{row.team.groupSetsLost})</span>
                  <span className="text-xs text-gray-500">{pointRatio} ({row.team.groupPtsWon}/{row.team.groupPtsLost})</span>
                  <span className={`font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-500'}`}>{difference >= 0 ? '+' : ''}{difference}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function ratio(won: number, lost: number) {
  if (lost > 0) return (won / lost).toFixed(2)
  return won > 0 ? '∞' : '—'
}
