'use client'
import React, { useState } from 'react'

const ROUND_LBL: Record<string, string> = {
  LL:'Lucky Loser', R64:'1/32', R32:'1/16', R16:'1/8', QF:'Ketvirtfinaliai',
  SF:'Pusfinaliai', F:'Finalas', '3rd':'Dėl 3 vietos', GF:'Grand Finalas',
  'LB-R1':'LB R1','LB-R2':'LB R2','LB-R3':'LB R3','LB-R4':'LB R4',
  'LB-R5':'LB R5','LB-SF':'LB Pusfin.','LB-F':'LB Finalas',
}

function roundLabel(round: string | null | undefined) {
  if (!round) return ''
  if (/^RR\d+$/.test(round)) return `Apskritasis R${round.slice(2)}`
  return ROUND_LBL[round] ?? round
}

// Filtrų ir rodymo eilė pagal realią KO etapų seką.
const ROUND_WAVE_16: Record<string, number> = {
  LL:      0,
  R64:     1,
  R32:     1,
  R16:     1,
  QF:      2,
  'LB-R1': 3,
  'LB-R2': 4,
  SF:      5,
  'LB-R3': 6,
  'LB-R4': 7,  'LB-R5': 7,  'LB-SF': 7,
  'LB-F':  8,
  '3rd':   9,
  F:       10,
  GF:      11,
}

const ROUND_WAVE_8: Record<string, number> = {
  LL:      0,
  QF:      1,
  'LB-R1': 2,
  SF:      3,
  'LB-R2': 4,
  'LB-SF': 5,
  F:       6,
  'LB-F':  7,
  '3rd':   8,
  GF:      9,
}

function getRoundWave(matches: any[]) {
  return matches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8
}

function roundWaveValue(round: string | null | undefined, waveMap: Record<string, number>) {
  if (round?.startsWith('RR')) {
    const n = Number(round.slice(2))
    return Number.isFinite(n) && n > 0 ? n : 99
  }
  return waveMap[round ?? ''] ?? 99
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
    if (m.status === 'FINISHED' && (!m.homeTeamId || !m.awayTeamId)) return false
    if (m.round === 'LB-R1' && loserSourceCount(m.matchNumber ?? null) < 2) return false
    if (m.round === 'LB-R2' && loserSourceCount(m.matchNumber ?? null) === 0) return false
    if (!hasWBFinal && !hasLBFinal && m.round === 'LB-SF' && (m.matchNumber ?? 1) > 1) return false
    return true
  })
}

// Generuoti aprašomąjį kodą TBD komandai
function matchCode(round: string|null, matchNum: number|null, side: 'home'|'away', allMatches: any[]): string {
  if (!round || matchNum === null) return 'TBD'

  const isEightTeamSheet = !allMatches.some(m => m.round === 'R16') && allMatches.some(m => m.round === 'QF')
  const hasLbFinal = allMatches.some(m => m.round === 'LB-F')
  const swapPair = (n: number) => n % 2 === 1 ? n + 1 : n - 1
  if (round === '3rd') {
    if (hasLbFinal) return side === 'home' ? 'LB Pusfin. pralaimėt.' : 'LB Finalas pralaimėt.'
    return side === 'home' ? 'SF1 pralaimėtojas' : 'SF2 pralaimėtojas'
  }
  if (round === 'GF')  return side === 'home' ? 'WB finalistas' : 'LB finalistas'
  if (round === 'F')   return side === 'home' ? 'SF1 laimėtojas' : 'SF2 laimėtojas'

  const WB_PREV: Record<string, string> = {
    QF: 'R16', SF: 'QF', R16: 'R32', R32: 'R64',
  }
  const LB_PREV: Record<string, { wb?: string; lb?: string }> = isEightTeamSheet ? {
    'LB-R1': { wb: 'QF' },
    'LB-R2': { lb: 'LB-R1', wb: 'SF' },
    'LB-SF': { lb: 'LB-R2' },
    'LB-F':  { lb: 'LB-SF' },
  } : {
    'LB-R1': { wb: 'R16' },
    'LB-R2': { lb: 'LB-R1', wb: 'QF' },
    'LB-R3': { lb: 'LB-R2' },
    'LB-R4': { lb: 'LB-R3', wb: 'SF' },
    'LB-R5': { lb: 'LB-R4' },
    'LB-SF': { lb: 'LB-R5' },
    'LB-F':  { lb: 'LB-SF' },
  }

  if (WB_PREV[round]) {
    const prevM = Math.ceil(matchNum / 2) * 2 - (side === 'home' ? 1 : 0)
    return `${WB_PREV[round].replace('LB-','LB')} M${prevM} laimėt.`
  }
  if (LB_PREV[round]) {
    const info = LB_PREV[round]
    if (round === 'LB-R1' && info.wb) {
      const sourceM = matchNum * 2 - (side === 'home' ? 1 : 0)
      return `${info.wb.replace('LB-','LB')} M${sourceM} pralaimėt.`
    }
    if (round === 'LB-R3' && info.lb) {
      const sourceM = matchNum * 2 - (side === 'home' ? 1 : 0)
      return `${info.lb.replace('LB-','LB')} M${sourceM} laimėt.`
    }
    if (round === 'LB-SF' && info.lb) {
      const sourceM = side === 'home' ? 1 : 2
      return `${info.lb.replace('LB-','LB')} M${sourceM} laimėt.`
    }
    if (side === 'home' && info.lb) return `${info.lb.replace('LB-','LB')} M${matchNum} laimėt.`
    if (info.wb) {
      const sourceM = round === 'LB-R2' || round === 'LB-R4' ? swapPair(matchNum) : matchNum
      return `${info.wb.replace('LB-','LB')} M${sourceM} pralaimėt.`
    }
    if (info.lb) return `${info.lb.replace('LB-','LB')} M${matchNum} laimėt.`
  }
  return `M${matchNum} ${side === 'home' ? '①' : '②'}`
}

// Komponentas kuris parodo automatinį pradžios laiką
function AutoStartInfo({ tournamentId, config, matches, startsAt }: any) {
  const [info, setInfo] = React.useState<string>('Skaičiuojama...')

  React.useEffect(() => {
    async function calc() {
      const firstKO = matches.find((m: any) => m.scheduledAt && m.status !== 'FINISHED')
      if (firstKO?.scheduledAt) {
        const t = new Date(firstKO.scheduledAt)
        setInfo(`KO pradžia: ${t.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}`)
        return
      }
      try {
        const res  = await fetch(`/api/tournaments/${tournamentId}/schedule`)
        const data = await res.json()
        if (data.ok && data.data.length > 0) {
          const groupDuration = config?.groupTimeMinutes ?? 45
          const last = [...data.data]
            .filter((m: any) => m.scheduledAt)
            .sort((a: any, b: any) =>
              new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
            )[0]
          if (last) {
            const lastEnd = new Date(last.scheduledAt)
            lastEnd.setMinutes(lastEnd.getMinutes() + groupDuration)
            const koStart = new Date(lastEnd)
            koStart.setMinutes(koStart.getMinutes() + 30)
            const rounded = Math.ceil(koStart.getMinutes() / 15) * 15
            koStart.setMinutes(rounded, 0, 0)
            const lastEndStr = lastEnd.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
            const koStr      = koStart.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
            setInfo(`Paskutinės grupių rungtynės: ${lastEndStr} → KO pradžia: ${koStr}`)
            return
          }
        }
      } catch {}
      setInfo('Grupių tvarkaraštis dar nesugeneruotas')
    }
    calc()
  }, [tournamentId, config, matches, startsAt])

  return <span className="text-xs text-gray-400">{info}</span>
}

export default function KOScheduleClient({ tournamentId, config, initialMatches, startsAt, initialRound = 'all' }:
  { tournamentId: string; config: any; initialMatches: any[]; startsAt: string; initialRound?: string }) {

  const [matches,   setMatches]   = useState<any[]>(initialMatches)
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState('')
  const [koMode,    setKoMode]    = useState<'auto' | 'manual'>('auto')
  const [koTimeStr, setKoTimeStr] = useState<string>('15:00')
  const [roundF,    setRoundF]    = useState(initialRound)

  const courts   = config?.knockoutCourts      ?? 2
  const duration = config?.knockoutTimeMinutes ?? 60
  const breakMin = config?.knockoutBreakMinutes ?? 0

  const visibleMatches = realKOMatches(matches)
  const hasSchedule = visibleMatches.some(m => m.scheduledAt)

  async function getStartTime(): Promise<Date> {
    if (koMode === 'manual') {
      const base = new Date(startsAt)
      const [h, m] = koTimeStr.split(':').map(Number)
      base.setHours(h, m, 0, 0)
      return base
    }
    try {
      const res  = await fetch(`/api/tournaments/${tournamentId}/schedule`)
      const data = await res.json()
      if (data.ok && data.data.length > 0) {
        const groupDuration = config?.groupTimeMinutes ?? 45
        const last = [...data.data]
          .filter((m: any) => m.scheduledAt)
          .sort((a: any, b: any) =>
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
          )[0]
        if (last) {
          const end = new Date(last.scheduledAt)
          end.setMinutes(end.getMinutes() + groupDuration + 30)
          const rounded = Math.ceil(end.getMinutes() / 15) * 15
          end.setMinutes(rounded, 0, 0)
          return end
        }
      }
    } catch {}
    const fallback = new Date(startsAt)
    fallback.setHours(15, 0, 0, 0)
    return fallback
  }

  async function generate() {
    setLoading(true); setMsg('')
    const startTime = await getStartTime()
    const res = await fetch(`/api/tournaments/${tournamentId}/knockout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'schedule',
        courts: Array.from({ length: courts }, (_, i) => ({
          courtId:       i + 1,
          name:          `Aikštelė ${i + 1}`,
          availableFrom: startTime.toISOString(),
          autoAssign:    true,
        })),
        matchDurationMinutes: duration,
        breakBetweenMinutes:  breakMin,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) window.location.reload()
    else setMsg(`Klaida: ${data.error}`)
  }

  // Filtruoti ir grupuoti pagal laiką
  const roundWave = getRoundWave(visibleMatches)
  const rounds   = [...new Set(visibleMatches.map(m => m.round).filter(Boolean))]
    .sort((a, b) => roundWaveValue(a, roundWave) - roundWaveValue(b, roundWave))
  const filtered = visibleMatches.filter(m => roundF === 'all' || m.round === roundF)

  const byTime: Record<string, any[]> = {}
  filtered.forEach(m => {
    const key = m.scheduledAt
      ? new Date(m.scheduledAt).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
      : '—'
    if (!byTime[key]) byTime[key] = []
    byTime[key].push(m)
  })

  return (
    <div className="space-y-4">
      {/* Valdymo juosta */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Auto / Rankinis */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            <button type="button" onClick={() => setKoMode('auto')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${koMode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Auto (po grupių)
            </button>
            <button type="button" onClick={() => setKoMode('manual')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${koMode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Nurodyti laiką
            </button>
          </div>

          {koMode === 'manual' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pradžia:</span>
              <input type="time" value={koTimeStr} onChange={e => setKoTimeStr(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}

          {koMode === 'auto' && (
            <AutoStartInfo tournamentId={tournamentId} config={config} matches={matches} startsAt={startsAt} />
          )}

          <div className="flex items-center gap-3 text-sm text-gray-600 ml-auto">
            <span>🏟 <strong>{courts}</strong> aik.</span>
            <span>⏱ <strong>{duration}</strong> min.</span>
            <a href={`/tournament/${tournamentId}/config`}
              className="text-xs text-gray-400 hover:text-gray-600 underline">Keisti →</a>
          </div>

          {msg && <p className="text-sm text-red-600 w-full">{msg}</p>}

          <form
            method="post"
            action={`/api/tournaments/${tournamentId}/knockout/schedule`}
            className="shrink-0"
            onSubmit={e => {
              if (koMode === 'manual') {
                e.preventDefault()
                generate()
              }
            }}>
            <input type="hidden" name="courts" value={courts} />
            <input type="hidden" name="duration" value={duration} />
            <input type="hidden" name="breakMin" value={breakMin} />
            <input type="hidden" name="startsAt" value={startsAt} />
            <button type="submit" disabled={loading || visibleMatches.length === 0}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? 'Generuojama...' : hasSchedule ? 'Pergeneruoti tvarkaraštį' : 'Generuoti tvarkaraštį'}
            </button>
          </form>
        </div>
      </div>

      {/* Filtrai */}
      {visibleMatches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <a href={`/tournament/${tournamentId}/knockout-schedule?round=all`} onClick={() => setRoundF('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${roundF === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Visi
          </a>
          {rounds.map(r => (
            <a key={r} href={`/tournament/${tournamentId}/knockout-schedule?round=${encodeURIComponent(r ?? '')}`} onClick={() => setRoundF(r ?? '')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${roundF === r ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {roundLabel(r)}
            </a>
          ))}
        </div>
      )}

      {/* Mačai pagal laiką */}
      {Object.entries(byTime)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([time, tMatches]) => (
          <div key={time}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold text-gray-700">{time}</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {tMatches
                .sort((a, b) => (a.court ?? 0) - (b.court ?? 0))
                .map(m => {
                  const hW    = m.winnerId && m.winnerId === m.homeTeamId
                  const aW    = m.winnerId && m.winnerId === m.awayTeamId
                  const hName = m.homeTeam?.team?.name
                  const aName = m.awayTeam?.team?.name
                  const hSeed = m.homeTeam?.seedRank
                  const aSeed = m.awayTeam?.seedRank
                  const hStats = m.homeTeam
                    ? `${m.homeTeam.groupWins ?? 0}L/${m.homeTeam.groupLosses ?? 0}P · ${m.homeTeam.groupPoints ?? 0}t.`
                    : null
                  const aStats = m.awayTeam
                    ? `${m.awayTeam.groupWins ?? 0}L/${m.awayTeam.groupLosses ?? 0}P · ${m.awayTeam.groupPoints ?? 0}t.`
                    : null
                  const round = roundLabel(m.round)
                  const setsStr = m.sets?.length
                    ? m.sets.map((s: any) => `${s.homeScore}:${s.awayScore}`).join(', ')
                    : null

                  return (
                    <div key={m.id}
                      className={`bg-white border rounded-xl p-3 flex gap-3 ${m.status === 'FINISHED' ? 'border-green-100' : 'border-gray-200'}`}>
                      {/* Kairė: aikštelė + raundas */}
                      <div className="flex flex-col items-center shrink-0 w-14 text-center">
                        <div className="text-xs font-medium bg-gray-100 rounded px-1.5 py-0.5 text-gray-600">
                          {m.court ? `A.${m.court}` : '—'}
                        </div>
                        {(m as any).matchOrder && (
                          <div className="text-xs text-gray-400 mt-0.5">#{(m as any).matchOrder}</div>
                        )}
                        <div className="text-xs text-purple-600 mt-1 font-medium">{round}</div>
                      </div>

                      {/* Komandų pavadinimai */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${hW ? 'font-semibold text-green-700' : aW ? 'text-gray-400' : hName ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {hSeed && <span className="text-xs text-gray-400 mr-1">#{hSeed}</span>}
                          {hName ?? <span className="text-gray-400 text-xs font-mono">{matchCode(m.round, m.matchNumber, 'home', matches)}</span>}
                          {hStats && hName && <span className="text-xs text-gray-400 ml-1.5 font-normal">{hStats}</span>}
                        </div>
                        <div className={`text-sm truncate mt-0.5 ${aW ? 'font-semibold text-green-700' : hW ? 'text-gray-400' : aName ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                          {aSeed && <span className="text-xs text-gray-400 mr-1">#{aSeed}</span>}
                          {aName ?? <span className="text-gray-400 text-xs font-mono">{matchCode(m.round, m.matchNumber, 'away', matches)}</span>}
                          {aStats && aName && <span className="text-xs text-gray-400 ml-1.5 font-normal">{aStats}</span>}
                        </div>
                        {setsStr && (
                          <div className="text-xs text-gray-400 mt-1">{setsStr}</div>
                        )}
                      </div>

                      {/* Statusas */}
                      {m.status === 'FINISHED' && (
                        <div className="shrink-0 text-green-500 text-sm">✓</div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        ))}

      {visibleMatches.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Braket dar nepageneruotas
        </div>
      )}
    </div>
  )
}
