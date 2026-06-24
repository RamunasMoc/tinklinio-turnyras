import type { KnockoutStandingsResult } from '@/lib/tournament/knockoutStandings'

function formatRatio(value: number) {
  if (value === Number.POSITIVE_INFINITY) return '∞'
  if (!value) return '—'
  return value.toFixed(3)
}

export default function KnockoutResultsTable({ result }: { result: KnockoutStandingsResult }) {
  if (result.rows.length === 0) return null

  return (
    <section className="mt-8 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Komandų rezultatai</h2>
          <p className="mt-0.5 text-xs text-gray-400">Tik atkrintamųjų rungtynių statistika</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${result.complete ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          {result.complete ? 'Galutinė rikiuotė' : 'Tarpinė rikiuotė'}
        </span>
      </div>

      {!result.complete && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Rikiuotė bus galutinė, kai bus baigtos visos vietas lemiančios atkrintamųjų rungtynės.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-medium text-gray-400">
              <th className="w-16 px-4 py-3 text-left">Vieta</th>
              <th className="w-14 px-2 py-3 text-center">Sėj.</th>
              <th className="min-w-56 px-3 py-3 text-left">Komanda</th>
              <th className="min-w-40 px-3 py-3 text-left">Rezultatas</th>
              <th className="px-3 py-3 text-center" title="Sužaistos rungtynės">R</th>
              <th className="px-3 py-3 text-center" title="Laimėjimai / pralaimėjimai">L/P</th>
              <th className="px-3 py-3 text-center">Setai</th>
              <th className="px-3 py-3 text-center">S. sant.</th>
              <th className="px-3 py-3 text-center">Taškai</th>
              <th className="px-3 py-3 text-center">T. sant.</th>
              <th className="px-4 py-3 text-center">+/-</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.rows.map(row => (
              <tr key={row.id} className="text-gray-600">
                <td className="px-4 py-3">
                  <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs font-bold ${row.place === '1' ? 'bg-yellow-400 text-white' : row.place === '2' ? 'bg-gray-300 text-white' : row.place === '3' ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {row.place}
                  </span>
                </td>
                <td className="px-2 py-3 text-center text-gray-400">{row.seed ? `#${row.seed}` : '—'}</td>
                <td className="px-3 py-3">
                  <div className="font-medium text-gray-900">{row.name}</div>
                  {row.club && <div className="mt-0.5 text-xs text-gray-400">{row.club}</div>}
                </td>
                <td className="px-3 py-3 text-xs font-medium text-gray-500">{row.statusLabel}</td>
                <td className="px-3 py-3 text-center">{row.played}</td>
                <td className="px-3 py-3 text-center"><span className="text-green-700">{row.wins}</span>/<span className="text-red-500">{row.losses}</span></td>
                <td className="px-3 py-3 text-center"><span className="text-green-700">{row.setsWon}</span>:<span className="text-red-500">{row.setsLost}</span></td>
                <td className="px-3 py-3 text-center font-mono text-xs">{formatRatio(row.setRatio)}</td>
                <td className="px-3 py-3 text-center"><span className="text-green-700">{row.pointsWon}</span>:<span className="text-red-500">{row.pointsLost}</span></td>
                <td className="px-3 py-3 text-center font-mono text-xs">{formatRatio(row.pointRatio)}</td>
                <td className={`px-4 py-3 text-center font-semibold ${row.pointDiff > 0 ? 'text-green-600' : row.pointDiff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {row.pointDiff > 0 ? '+' : ''}{row.pointDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
