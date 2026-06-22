'use client'
import { useEffect, useState } from 'react'
import { useRouter }             from 'next/navigation'

type Player = { firstName:string; lastName:string }
type Team   = { name:string; club:string|null; players:Player[] }
type TT     = {
  id:string; team:Team; seeded:boolean; seedRank:number|null;
  groupPoints:number; groupWins:number; groupLosses:number;
  groupSetsWon:number; groupSetsLost:number;
  groupPtsWon:number; groupPtsLost:number;
}
type Match  = { homeTeamId:string|null; awayTeamId:string|null; winnerId:string|null; status:string }
type Group  = { id:string; name:string; advanceCount:number; teams:TT[]; matches?:Match[] }

function safeRatio(a:number, b:number): number {
  if (b === 0) return a === 0 ? 1 : 999
  return a / b
}

function headToHeadOrder(a: TT, b: TT, teams: TT[], matches: Match[] = []) {
  const samePoints = teams.filter(t => t.groupPoints === a.groupPoints)
  if (a.groupPoints !== b.groupPoints || samePoints.length !== 2) return 0

  const match = matches.find(m =>
    m.status === 'FINISHED' &&
    ((m.homeTeamId === a.id && m.awayTeamId === b.id) ||
     (m.homeTeamId === b.id && m.awayTeamId === a.id))
  )
  if (!match?.winnerId) return 0
  if (match.winnerId === a.id) return -1
  if (match.winnerId === b.id) return 1
  return 0
}

function sortTeams(teams: TT[], matches: Match[] = []): TT[] {
  return [...teams].sort((a, b) => {
    // 1. Taškai
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints
    // 2. Jei lygiai taškų turi tik dvi komandos - tarpusavio rungtynės
    const h2h = headToHeadOrder(a, b, teams, matches)
    if (h2h !== 0) return h2h
    // 3. Laimėjimai
    if (b.groupWins !== a.groupWins) return b.groupWins - a.groupWins
    // 4. Setų santykis
    const asr = safeRatio(a.groupSetsWon, a.groupSetsLost)
    const bsr = safeRatio(b.groupSetsWon, b.groupSetsLost)
    if (Math.abs(bsr - asr) > 0.001) return bsr - asr
    // 5. Taškų santykis
    const apr = safeRatio(a.groupPtsWon, a.groupPtsLost)
    const bpr = safeRatio(b.groupPtsWon, b.groupPtsLost)
    if (Math.abs(bpr - apr) > 0.001) return bpr - apr
    // 6. +/-
    return (b.groupPtsWon - b.groupPtsLost) - (a.groupPtsWon - a.groupPtsLost)
  })
}

export default function StandingsClient({ tournamentId, initialGroups, advanceCount, publicView = false }:
  { tournamentId:string; initialGroups:Group[]; advanceCount:number; publicView?:boolean }) {

  const router = useRouter()
  const [groups,    setGroups]    = useState<Group[]>(initialGroups)
  const [loading,   setLoading]   = useState(false)
  const [lastUpdate,setLastUpdate] = useState<string|null>(null)

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  async function refresh() {
    setLoading(true)
    if (publicView) {
      router.refresh()
      setLastUpdate(new Date().toLocaleTimeString('lt-LT'))
      setLoading(false)
      return
    }
    const res  = await fetch(`/api/tournaments/${tournamentId}/groups`)
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setGroups(data.data)
      setLastUpdate(new Date().toLocaleTimeString('lt-LT'))
    }
  }

  // Visi kursims patenka į atkrintamąsias (globaliai surūšiuoti pagal poziciją)
  // Pirma visi 1-ieji, tada visi 2-ieji ir t.t.
  const advancingIds = new Set<string>()
  const maxAdv = Math.max(...groups.map(g => g.advanceCount))
  for (let pos = 0; pos < maxAdv; pos++) {
    for (const g of groups) {
      if (pos < g.advanceCount) {
        const sorted = sortTeams(g.teams, g.matches ?? [])
        if (sorted[pos]) advancingIds.add(sorted[pos].id)
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Grupių lentelė</h1>
        {!publicView && <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-gray-400">Atnaujinta: {lastUpdate}</span>
          )}
          <button onClick={refresh} disabled={loading}
            className={`px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 ${loading?'animate-pulse':''}`}>
            <span className={loading?'animate-spin inline-block':''}>↺</span>
            Atnaujinti
          </button>
        </div>}
      </div>

      {/* Legenda */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block"/> Patenka į atkrintamąsias</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300 inline-block"/> Sėjamoji</span>
        <span className="text-gray-400">T = taškai · R = rungtynės · L/P = laimėjimai/pralaimėjimai · S = setų santykis · +/- = taškų skirtumas</span>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
          <p className="text-lg mb-2">📊</p>
          <p>Grupės dar nesudaryta.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => {
            const sorted   = sortTeams(g.teams, g.matches ?? [])
            const played   = sorted.some(t => t.groupWins > 0 || t.groupLosses > 0)
            return (
              <div key={g.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Grupės header */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-lg">Grupė {g.name}</span>
                    <span className="text-xs text-gray-400">{g.teams.length} komandos</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">
                    Patenka: {g.advanceCount}
                  </span>
                </div>

                {/* Lentelė */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 w-7">#</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Komanda</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-8" title="Rungtynės">R</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-14" title="Laimėjimai / Pralaimėjimai">L/P</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-10 bg-gray-100" title="Taškai">T</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-20" title="Setai laimėti:pralaišti">Setai</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-16" title="Setų santykis">S sant.</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-20" title="Taškai laimėti:pralaišti">Taškai</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-16" title="Taškų santykis">T sant.</th>
                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 w-14" title="Taškų skirtumas">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((tt, i) => {
                        const adv     = advancingIds.has(tt.id)
                        const pm      = tt.groupPtsWon - tt.groupPtsLost
                        const setR    = safeRatio(tt.groupSetsWon, tt.groupSetsLost)
                        const ptR     = safeRatio(tt.groupPtsWon, tt.groupPtsLost)
                        const played1 = tt.groupWins + tt.groupLosses
                        const players = tt.team.players ?? []
                        return (
                          <tr key={tt.id}
                            className={`border-b border-gray-50 last:border-0 transition-colors
                              ${adv ? 'bg-green-50/60' : ''}
                              ${tt.seeded && adv ? 'bg-yellow-50/60' : ''}
                              ${tt.seeded && !adv ? 'bg-yellow-50/30' : ''}`}>

                            {/* Pozicija */}
                            <td className="px-3 py-3">
                              <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold
                                ${i===0?'bg-yellow-400 text-white':i===1?'bg-gray-300 text-white':i===2?'bg-orange-300 text-white':'text-gray-400 font-normal'}`}>
                                {i+1}
                              </span>
                            </td>

                            {/* Komanda */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {tt.seeded && (
                                  <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">S{tt.seedRank}</span>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900">{tt.team.name}</div>
                                  {tt.team.club && <div className="text-xs text-gray-400">{tt.team.club}</div>}
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {players[0]?.firstName} {players[0]?.lastName}
                                    {players[1] && ` / ${players[1].firstName} ${players[1].lastName}`}
                                  </div>
                                </div>
                                {adv && (
                                  <span className="ml-1 text-xs text-green-600 font-medium">→ KO</span>
                                )}
                              </div>
                            </td>

                            {/* Rungtynės */}
                            <td className="px-3 py-3 text-center text-gray-600">{played1}</td>

                            {/* L/P */}
                            <td className="px-3 py-3 text-center">
                              <span className="text-green-700 font-medium">{tt.groupWins}</span>
                              <span className="text-gray-300 mx-0.5">/</span>
                              <span className="text-red-500">{tt.groupLosses}</span>
                            </td>

                            {/* Taškai */}
                            <td className="px-3 py-3 text-center bg-gray-50/50">
                              <span className="text-base font-bold text-gray-900">{tt.groupPoints}</span>
                            </td>

                            {/* Setai */}
                            <td className="px-3 py-3 text-center text-xs text-gray-600">
                              <span className="text-green-700 font-medium">{tt.groupSetsWon}</span>
                              <span className="text-gray-300 mx-0.5">:</span>
                              <span className="text-red-500">{tt.groupSetsLost}</span>
                            </td>

                            {/* Setų santykis */}
                            <td className="px-3 py-3 text-center text-xs font-mono text-gray-600">
                              {tt.groupSetsLost > 0 ? setR.toFixed(3) : tt.groupSetsWon > 0 ? '∞' : '—'}
                            </td>

                            {/* Taškai W:L */}
                            <td className="px-3 py-3 text-center text-xs text-gray-600">
                              <span className="text-green-700 font-medium">{tt.groupPtsWon}</span>
                              <span className="text-gray-300 mx-0.5">:</span>
                              <span className="text-red-500">{tt.groupPtsLost}</span>
                            </td>

                            {/* Taškų santykis */}
                            <td className="px-3 py-3 text-center text-xs font-mono text-gray-600">
                              {tt.groupPtsLost > 0 ? ptR.toFixed(3) : tt.groupPtsWon > 0 ? '∞' : '—'}
                            </td>

                            {/* +/- */}
                            <td className="px-3 py-3 text-center">
                              <span className={`text-sm font-bold ${pm > 0 ? 'text-green-600' : pm < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {pm > 0 ? '+' : ''}{pm}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Grupės rungtynių progresa */}
                {played && (() => {
                  const totalMatches = g.teams.length * (g.teams.length - 1) / 2
                  const doneMatches  = sorted.reduce((s,t) => s + t.groupWins + t.groupLosses, 0) / 2
                  const pct          = Math.round(doneMatches / totalMatches * 100)
                  return (
                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{width:`${pct}%`}}/>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{Math.round(doneMatches)}/{totalMatches} rungtynių</span>
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
