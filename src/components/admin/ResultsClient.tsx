'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type SetData = { setNumber:number; homeScore:number; awayScore:number; isTiebreak:boolean }
type Match   = {
  id:string; status:string; court:number|null; scheduledAt:string|null; matchNumber:number|null; round?:string|null;
  group:{name:string}|null; sets:SetData[];
  homeTeam:{id:string;seedRank?:number|null;team:{name:string}}|null;
  awayTeam:{id:string;seedRank?:number|null;team:{name:string}}|null;
  homeSets:number|null; awaySets:number|null
}

const STATUS_LBL: Record<string,string> = { SCHEDULED:'Planuojama', IN_PROGRESS:'Vyksta', FINISHED:'Baigta', WALKOVER:'Walk-over' }
const STATUS_CLS: Record<string,string> = { SCHEDULED:'bg-gray-100 text-gray-500', IN_PROGRESS:'bg-yellow-100 text-yellow-700', FINISHED:'bg-green-100 text-green-700', WALKOVER:'bg-red-100 text-red-700' }
const ROUND_LBL: Record<string,string> = {
  LL:'Lucky Loser', R64:'1/32', R32:'1/16', R16:'1/8',
  QF:'Ketvirtfinaliai', SF:'Pusfinaliai', F:'Finalas', '3rd':'Dėl 3 vietos',
  GF:'Grand Finalas', 'LB-R1':'LB R1','LB-R2':'LB R2','LB-R3':'LB R3',
  'LB-SF':'LB Pusfin.','LB-F':'LB Finalas',
}

function roundLabel(round: string | null | undefined) {
  if (!round) return ''
  if (/^RR\d+$/.test(round)) return `Apskritasis R${round.slice(2)}`
  return ROUND_LBL[round] ?? round
}

// ─── Atsitiktinio rezultato generatorius ─────────────────────
// Atsižvelgia į turnyro formatą: 1 setas arba Best of 2
// Lygiosios NEGALIMOS — visuomet yra aiškus nugalėtojas

function randLoser(limit: number): number {
  // Pralaimėtojas gauna 10...(limit-2) taškų — realus rezultatas
  const max = limit - 2
  const min = Math.min(10, max - 1)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateRandomSets(format: string, tbPts: number, forceHomeWins?: boolean): SetData[] {
  const limit    = format.includes('15') ? 15 : 21
  const homeWins = forceHomeWins ?? Math.random() > 0.5

  // 1 setas formatai
  if (format.startsWith('ONE_') || format.startsWith('1s') || format === '1set-21' || format === '1set-15') {
    return [{
      setNumber:  1,
      homeScore:  homeWins ? limit : randLoser(limit),
      awayScore:  homeWins ? randLoser(limit) : limit,
      isTiebreak: false,
    }]
  }

  // Best of 2 — 60% šansų 2:0, 40% šansų 1:1 + tiebreak
  const straight = Math.random() > 0.4

  if (straight) {
    // 2:0 — abu setus laimi tas pats
    return [
      { setNumber:1, homeScore: homeWins?limit:randLoser(limit), awayScore: homeWins?randLoser(limit):limit, isTiebreak:false },
      { setNumber:2, homeScore: homeWins?limit:randLoser(limit), awayScore: homeWins?randLoser(limit):limit, isTiebreak:false },
    ]
  } else {
    // 1:1 + tiebreak — S1 ir S2 laimi skirtingi žaidėjai, TB sprendžia
    // S1 laimi home, S2 laimi away (arba atvirkščiai)
    const s1Home = Math.random() > 0.5
    return [
      { setNumber:1, homeScore: s1Home?limit:randLoser(limit),   awayScore: s1Home?randLoser(limit):limit,   isTiebreak:false },
      { setNumber:2, homeScore: s1Home?randLoser(limit):limit,   awayScore: s1Home?limit:randLoser(limit),   isTiebreak:false },
      { setNumber:3, homeScore: homeWins?tbPts:randLoser(tbPts), awayScore: homeWins?randLoser(tbPts):tbPts, isTiebreak:true  },
    ]
  }
}

function rankedHomeWins(match: Match): boolean | undefined {
  const homeSeed = match.homeTeam?.seedRank
  const awaySeed = match.awayTeam?.seedRank
  if (homeSeed == null || awaySeed == null) return undefined
  if (homeSeed === awaySeed) return undefined
  return homeSeed < awaySeed
}

function realKOMatches(matches: Match[]) {
  const hasWBFinal = matches.some((m: any) => m.round === 'F')
  const hasLBFinal = matches.some((m: any) => m.round === 'LB-F')
  const hasTeam = (m: any, side: 'home' | 'away') =>
    side === 'home' ? !!(m.homeTeamId ?? m.homeTeam?.id) : !!(m.awayTeamId ?? m.awayTeam?.id)
  const loserSourceCount = (matchNumber: number | null) => {
    const firstRound = matches.some((m: any) => m.round === 'R16') ? 'R16' : 'QF'
    return [(matchNumber ?? 1) * 2 - 1, (matchNumber ?? 1) * 2].filter(n => {
      const source = matches.find((m: any) => m.round === firstRound && m.matchNumber === n) as any
      return source && hasTeam(source, 'home') && hasTeam(source, 'away')
    }).length
  }
  return matches.filter((m: any) => {
    if (m.status === 'FINISHED' && (!m.homeTeam || !m.awayTeam)) return false
    if (m.round === 'LB-R1' && loserSourceCount(m.matchNumber ?? null) < 2) return false
    if (m.round === 'LB-R2' && loserSourceCount(m.matchNumber ?? null) === 0) return false
    if (!hasWBFinal && !hasLBFinal && m.round === 'LB-SF' && (m.matchNumber ?? 1) > 1) return false
    return true
  })
}

// ─── Rezultatų validacija ────────────────────────────────────
// Grąžina klaidos tekstą arba null jei gerai

function validateSets(sets: {h:string;a:string;tb:boolean}[], format: string, tbPts: number): string | null {
  const limit    = format.includes('15') ? 15 : 21
  const mainSets = sets.filter(s => !s.tb && (s.h !== '' || s.a !== ''))

  if (mainSets.length === 0) return 'Įveskite bent vieno seto rezultatą'

  for (const s of mainSets) {
    const h = parseInt(s.h)||0, a = parseInt(s.a)||0
    if (h === a) return `Lygiosios (${h}:${a}) negalimos — turi būti nugalėtojas`
  }

  const hSets = mainSets.filter(s => (parseInt(s.h)||0) > (parseInt(s.a)||0)).length
  const aSets = mainSets.filter(s => (parseInt(s.a)||0) > (parseInt(s.h)||0)).length

  // Jei 1:1 — privalomas tiebreak
  if (hSets === 1 && aSets === 1) {
    const tbSet = sets.find(s => s.tb)
    if (!tbSet || (tbSet.h === '' && tbSet.a === '')) {
      return 'Rezultatas 1:1 — privalomas tiebreak setas'
    }
    const th = parseInt(tbSet.h)||0, ta = parseInt(tbSet.a)||0
    if (th === ta) return `Tiebreak lygiosios (${th}:${ta}) negalimos`
  }

  return null
}

export default function ResultsClient({ tournamentId, initialMatches, setFormat, tbPoints, isKO: isKOProp }:
  { tournamentId:string; initialMatches:Match[]; setFormat:string; tbPoints:number; isKO?:boolean }) {

  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [active,  setActive]  = useState<Match|null>(null)
  const [sets,    setSets]    = useState<{h:string;a:string;tb:boolean}[]>([])
  const [hasTb,   setHasTb]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [filling, setFilling] = useState(false)
  const [groupF,  setGroupF]  = useState('all')
  const [teamF,   setTeamF]   = useState('all')
  const [valErr,  setValErr]  = useState('')

  const router = useRouter()
  const isKO = isKOProp ?? (initialMatches.length > 0 && initialMatches.every(m => !(m as any).group))

  // Užkrauti šviežius duomenis iš karto kai komponentas montuojasi
  useEffect(() => {
    async function load() {
      try {
        if (isKO) {
          await fetch(`/api/tournaments/${tournamentId}/knockout/recalc`, { method: 'POST' })
        }
        const url = isKO
          ? `/api/tournaments/${tournamentId}/knockout`
          : `/api/tournaments/${tournamentId}/schedule`
        const res  = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (data.ok && Array.isArray(data.data)) setMatches(data.data)
      } catch {}
    }
    load()
  }, [tournamentId, isKO])

  // Atnaujinti kai puslapis gauna fokusą
  useEffect(() => {
    async function refresh() {
      try {
        const url = isKO
          ? `/api/tournaments/${tournamentId}/knockout`
          : `/api/tournaments/${tournamentId}/schedule`
        const res  = await fetch(url, { cache: 'no-store' })
        const data = await res.json()
        if (data.ok && Array.isArray(data.data)) setMatches(data.data)
      } catch {}
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [tournamentId, isKO])

  // Išsaugoti pradinę mačų eilę pagal ID
  const [initialOrder] = useState<string[]>(() => initialMatches.map(m => m.id))

  // Rūšiuoti pagal pradinę eilę
  function sortByInitialOrder(ms: Match[]): Match[] {
    const orderMap = new Map(initialOrder.map((id, i) => [id, i]))
    return [...ms].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 9999
      const bi = orderMap.get(b.id) ?? 9999
      return ai - bi
    })
  }

  async function refreshMatches() {
    try {
      const url = isKO
        ? `/api/tournaments/${tournamentId}/knockout`
        : `/api/tournaments/${tournamentId}/schedule`
      const res  = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      if (data.ok && Array.isArray(data.data)) {
        const fresh = data.data as Match[]
        // Jei mačų ID pasikeitė (pvz. po grupių perbraižymo) — naudoti naują eilę
        const sameIds = fresh.every(m => initialOrder.includes(m.id))
        if (sameIds) {
          setMatches(sortByInitialOrder(fresh))
        } else {
          // Nauji mačai — naudoti serverio eilę
          setMatches(fresh)
        }
      }
    } catch {}
  }

  const ROUND_WAVE_16: Record<string,number> = {
    LL:0,
    R64:1, R32:1, R16:1,
    QF:2, 'LB-R1':3, 'LB-R2':4,
    SF:5, 'LB-R3':6, 'LB-R4':7,
    'LB-SF':7, F:8, 'LB-F':8, '3rd':9,
    GF:10,
  }
  const ROUND_WAVE_8: Record<string,number> = {
    LL:0,
    QF:1,
    'LB-R1':2,
    SF:3,
    'LB-R2':4,
    'LB-SF':5,
    F:6,
    'LB-F':7,
    '3rd':8,
    GF:9,
  }
  const roundWave = matches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8
  const waveOf = (round: string | null | undefined, waveMap = roundWave) => {
    if (round?.startsWith('RR')) {
      const n = Number(round.slice(2))
      return Number.isFinite(n) && n > 0 ? n : 99
    }
    return waveMap[round ?? ''] ?? 99
  }

  function matchSortKey(m: Match): number {
    // Naudoti matchOrder jei yra (tikslus eilės numeris)
    const order = (m as any).matchOrder
    if (order && order > 0) return order
    // Kitaip pagal bangą ir matchNumber
    const wave = waveOf((m as any).round)
    return wave * 1000 + ((m as any).matchNumber ?? 0)
  }

  const visibleMatches = isKO ? realKOMatches(matches) : matches
  const groups   = [...new Set(visibleMatches.map(m=>m.group?.name).filter(Boolean))] as string[]
  const teams = [...new Map(
    visibleMatches.flatMap(m => [m.homeTeam, m.awayTeam])
      .filter((team): team is NonNullable<Match['homeTeam']> => !!team)
      .map(team => [team.id, team.team.name]),
  ).entries()].sort((a, b) => a[1].localeCompare(b[1], 'lt'))
  const filtered = [...visibleMatches]
    .filter(m => groupF==='all' || m.group?.name===groupF)
    .filter(m => teamF==='all' || m.homeTeam?.id===teamF || m.awayTeam?.id===teamF)
    .sort((a,b) => matchSortKey(a) - matchSortKey(b))
  const pending  = visibleMatches.filter(m => m.status !== 'FINISHED')
  const fillablePending = pending.filter(m => !isKO || (m.homeTeam && m.awayTeam))
  const randomFillCount = isKO ? pending.length : fillablePending.length

  function initSets(m: Match) {
    if (m.sets.length > 0) {
      const hasTiebreak = m.sets.some(s => s.isTiebreak)
      setHasTb(hasTiebreak)
      setSets(m.sets.map(s => ({ h: String(s.homeScore), a: String(s.awayScore), tb: s.isTiebreak })))
    } else {
      setHasTb(false)
      setSets([{h:'',a:'',tb:false},{h:'',a:'',tb:false}])
    }
    setValErr('')
  }

  function openMatch(m: Match) {
    setActive(m)
    initSets(m)
  }

  // Auto-detect: jei abu setai įvesti ir 1:1 — automatiškai rodyti tiebreak
  function onSetChange(i: number, side: 'h'|'a', val: string) {
    const newSets = sets.map((s,j) => j===i ? {...s,[side]:val} : s)
    setSets(newSets)
    setValErr('')

    // Automatiškai pridėti tiebreak jei 1:1
    const main    = newSets.filter(s => !s.tb)
    const hWins   = main.filter(s => s.h !== '' && s.a !== '' && parseInt(s.h) > parseInt(s.a)).length
    const aWins   = main.filter(s => s.h !== '' && s.a !== '' && parseInt(s.a) > parseInt(s.h)).length
    const needsTb = hWins === 1 && aWins === 1
    if (needsTb && !hasTb) {
      setHasTb(true)
      setSets(prev => [...prev.filter(s=>!s.tb), {h:'',a:'',tb:true}])
    } else if (!needsTb && hasTb && newSets.some(s=>s.tb&&s.h===''&&s.a==='')) {
      // Jei nebereikia TB ir jis tuščias — išimti
      setHasTb(false)
      setSets(prev => prev.filter(s=>!s.tb))
    }
  }

  async function saveResult() {
    if (!active) return
    const err = validateSets(sets, setFormat, tbPoints)
    if (err) { setValErr(err); return }

    setSaving(true); setValErr('')
    const payload = {
      sets: sets
        .filter(s => s.h !== '' || s.a !== '')
        .map((s, i) => ({
          setNumber:  i + 1,
          homeScore:  parseInt(s.h) || 0,
          awayScore:  parseInt(s.a) || 0,
          isTiebreak: s.tb,
        })),
    }
    const res  = await fetch(`/api/tournaments/${tournamentId}/matches/${active.id}/sets`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      const updated = data.data
      setMatches(prev => sortByInitialOrder(prev.map(m => m.id===active.id
        ? { ...m,
            status:   updated.status   ?? 'FINISHED',
            homeSets: updated.homeSets ?? null,
            awaySets: updated.awaySets ?? null,
            sets:     updated.sets     ?? payload.sets as SetData[],
          }
        : m
      )))
      setActive(null)
      refreshMatches()
      router.refresh()
    }
  }

  // Užpildyti vienas rungtynes atsitiktinai
  async function fillOneRandom(match: Match) {
    const randomSets = generateRandomSets(setFormat, tbPoints, isKO ? rankedHomeWins(match) : undefined)
    const res  = await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/sets`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sets: randomSets }),
    })
    const data = await res.json()
    if (data.ok) {
      const updated = data.data
      setMatches(prev => sortByInitialOrder(prev.map(m => m.id===match.id
        ? { ...m, status:'FINISHED', homeSets: updated.homeSets, awaySets: updated.awaySets, sets: updated.sets ?? randomSets }
        : m
      )))
      refreshMatches()
      router.refresh()
    }
  }

  async function clearAllResults() {
    const done = matches.filter(m => m.status === 'FINISHED')
    if (!confirm(`Išvalyti visus ${done.length} įvestus rezultatus? Komandos bus pašalintos iš nebaigto etapo.`)) return
    setFilling(true)

    // 1. Išvalyti rezultatus
    for (const match of done) {
      await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/sets`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ sets: [] }),
      })
    }

    // 2. Jei KO - išvalyti komandas iš TBD mačų (kurios atsirado per advanceWinner)
    if (isKO) {
      await fetch(`/api/tournaments/${tournamentId}/knockout/clear`, { method: 'POST' })
      // Po KO išvalymo perkrauti puslapį nes braket pasikeičia iš esmės
      window.location.reload()
      return
    }

    setActive(null)
    setFilling(false)
    await refreshMatches()
    router.refresh()
  }

  async function fillAllRandom() {
    if (!confirm(`Užpildyti ${randomFillCount} likusias rungtynes atsitiktiniais rezultatais?`)) return
    setFilling(true)

    // KO atveju: pildyti raundas po raundo, po kiekvieno raundo
    // atnaujinti mačų sąrašą kad sekančio raundo mačai turėtų komandas
    if (isKO) {
      await fetch(`/api/tournaments/${tournamentId}/knockout/recalc`, { method: 'POST' })

      // Pildyti banga po bangos, po kiekvienos bangos atnaujinti mačus
      // Kartojame kol nebelieka pildomų mačų. DE braketui reikia pereiti
      // per WB/LB bangas iki GF, todėl 8 iteracijų ne visada pakanka.
      for (let iteration = 0; iteration < 40; iteration++) {
        await fetch(`/api/tournaments/${tournamentId}/knockout/recalc`, { method: 'POST' })

        // Gauti šviežius mačus iš serverio
        const res  = await fetch(`/api/tournaments/${tournamentId}/knockout`, { cache: 'no-store' })
        const data = await res.json()
        if (!data.ok) break
        const freshMatches = realKOMatches(data.data as Match[]) as any[]
        const freshRoundWave = freshMatches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8
        const freshWaveOf = (round: string | null | undefined) => {
          if (round?.startsWith('RR')) {
            const n = Number(round.slice(2))
            return Number.isFinite(n) && n > 0 ? n : 99
          }
          return freshRoundWave[round ?? ''] ?? 99
        }

        // Rasti mačus kuriuos galima dabar pildyti (abi komandos žinomos, ne baigti)
        const fillable = freshMatches.filter(m =>
          m.status !== 'FINISHED' && m.homeTeamId && m.awayTeamId
        ).sort((a,b) => {
          const aw = freshWaveOf(a.round)
          const bw = freshWaveOf(b.round)
          if (aw !== bw) return aw - bw
          return (a.matchNumber ?? 0) - (b.matchNumber ?? 0)
        })

        if (fillable.length === 0) break

        // Pildyti tik pirmą bangą (mažiausią wave numerį)
        const minWave = freshWaveOf(fillable[0].round)
        const waveMathces = fillable.filter(m => freshWaveOf(m.round) === minWave)

        for (const match of waveMathces) {
          const randomSets = generateRandomSets(setFormat, tbPoints, rankedHomeWins(match as Match))
          await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/sets`, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ sets: randomSets }),
          })
        }
        // Atnaujinti UI po bangos
        await refreshMatches()
      }
    } else {
      // Grupių etapas – pildyti visus iš eilės
      for (const match of fillablePending) {
        const randomSets = generateRandomSets(setFormat, tbPoints)
        const res  = await fetch(`/api/tournaments/${tournamentId}/matches/${match.id}/sets`, {
          method:'PUT', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ sets: randomSets }),
        })
        const data = await res.json()
        if (data.ok) {
          const updated = data.data
          setMatches(prev => sortByInitialOrder(prev.map(m => m.id===match.id
            ? { ...m,
                status:   updated.status   ?? 'FINISHED',
                homeSets: updated.homeSets ?? null,
                awaySets: updated.awaySets ?? null,
                sets:     updated.sets     ?? randomSets,
              }
            : m
          )))
        }
      }
    }

    setFilling(false)
    await refreshMatches()
    router.refresh()
  }

  const inp = 'w-full px-2 py-2 border border-gray-300 rounded-lg text-center text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Rezultatai</h1>
        {fillablePending.length > 0 && (
          <form
            method="post"
            action={`/api/tournaments/${tournamentId}/results/actions`}
            onSubmit={e => {
              if (typeof window !== 'undefined') {
                e.preventDefault()
                fillAllRandom()
              }
            }}>
            <input type="hidden" name="action" value="randomAll" />
            <input type="hidden" name="isKO" value={isKO ? 'true' : 'false'} />
            <button type="submit" disabled={filling}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
              {filling ? <><span className="animate-spin inline-block">⟳</span> Užpildoma...</> : <>🎲 Užpildyti atsitiktinai ({randomFillCount})</>}
            </button>
          </form>
        )}
        {pending.length === 0 && <span className="text-sm text-green-600 font-medium">✓ Visi rezultatai įvesti</span>}
        {pending.length > 0 && fillablePending.length === 0 && (
          <span className="text-sm text-gray-500 font-medium">Laukiama komandų kituose mačuose</span>
        )}
        {matches.some(m => m.status === 'FINISHED') && (
          <form
            method="post"
            action={`/api/tournaments/${tournamentId}/results/actions`}
            onSubmit={e => {
              if (typeof window !== 'undefined') {
                e.preventDefault()
                clearAllResults()
              }
            }}>
            <input type="hidden" name="action" value="clearAll" />
            <input type="hidden" name="isKO" value={isKO ? 'true' : 'false'} />
            <button type="submit" disabled={filling}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-2">
              🗑 Išvalyti visus
            </button>
          </form>
        )}
      </div>

      {/* Redaktorius */}
      {active && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-gray-700">
                Grupė {active.group?.name}
                {active.scheduledAt && ` · ${new Date(active.scheduledAt).toLocaleTimeString('lt-LT',{hour:'2-digit',minute:'2-digit'})}`}
                {active.court && ` · Aik. ${active.court}`}
              </span>
              {active.status === 'FINISHED' && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Koregavimas</span>
              )}
            </div>
            <button onClick={()=>setActive(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-700 truncate">{active.homeTeam?.team.name}</p>
            </div>
            <div className="text-center text-gray-400 text-sm flex items-center justify-center">prieš</div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium text-gray-700 truncate">{active.awayTeam?.team.name}</p>
            </div>
          </div>

          <div className="space-y-3 mb-3">
            {sets.map((s, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 items-center">
                <input className={`${inp} ${s.h!==''&&s.a!==''&&parseInt(s.h)>parseInt(s.a)?'border-green-400 bg-green-50':s.h!==''&&s.a!==''&&parseInt(s.a)>parseInt(s.h)?'border-red-300 bg-red-50':''}`}
                  type="number" min="0" max={s.tb?tbPoints+2:25} value={s.h}
                  onChange={e=>onSetChange(i,'h',e.target.value)} placeholder="0"/>
                <div className={`text-center text-xs font-medium ${s.tb?'text-amber-600':'text-gray-400'}`}>
                  {s.tb ? `TB (iki ${tbPoints})` : `S${i+1}`}
                </div>
                <input className={`${inp} ${s.h!==''&&s.a!==''&&parseInt(s.a)>parseInt(s.h)?'border-green-400 bg-green-50':s.h!==''&&s.a!==''&&parseInt(s.h)>parseInt(s.a)?'border-red-300 bg-red-50':''}`}
                  type="number" min="0" max={s.tb?tbPoints+2:25} value={s.a}
                  onChange={e=>onSetChange(i,'a',e.target.value)} placeholder="0"/>
              </div>
            ))}
          </div>

          {/* Tiebreak informacija */}
          <p className="text-xs text-gray-400 mb-3">
            {hasTb
              ? '🔶 Tiebreak setas aktyvus — rezultatas 1:1'
              : 'Tiebreak pridedamas automatiškai kai rezultatas 1:1'}
          </p>

          {/* Validacijos klaida */}
          {valErr && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⚠️ {valErr}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={()=>setActive(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Atšaukti</button>
            <button onClick={saveResult} disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? 'Saugoma...' : active.status==='FINISHED' ? 'Išsaugoti koregavimą' : 'Išsaugoti'}
            </button>
          </div>
        </div>
      )}

      {/* Filtras */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['all',...groups].map(g=>(
            <button key={g} onClick={()=>setGroupF(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupF===g?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {g==='all'?'Visos':`Grupė ${g}`}
            </button>
          ))}
        </div>
        <label className="block w-full sm:w-64">
          <span className="mb-1 block text-xs font-medium text-gray-500">Komanda</span>
          <select
            value={teamF}
            onChange={event => setTeamF(event.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-gray-500 focus:outline-none"
          >
            <option value="all">Visos komandos</option>
            {teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>

      {/* Sąrašas — VISOS rungtynės klikuojamos (ir baigtos) */}
      <div className="space-y-2">
        {filtered.map(m => {
          const setsStr  = m.sets.map((s:any)=>`${s.homeScore}:${s.awayScore}`).join(' ')
          // Visų setų skaičius įskaitant tiebreak
          const hSetsAll = m.sets.filter((s:any) => s.homeScore > s.awayScore).length
          const aSetsAll = m.sets.filter((s:any) => s.awayScore > s.homeScore).length
          // Laimėtojas pagal visus setus (su tiebreak: 2:1, ne 1:1)
          const hWin     = m.status==='FINISHED' && hSetsAll > aSetsAll
          const aWin     = m.status==='FINISHED' && aSetsAll > hSetsAll
          const isActive = active?.id === m.id
          return (
            <div key={m.id}
              className={`bg-white border rounded-xl p-3 transition-colors
                ${isActive?'border-blue-400 bg-blue-50/30':m.status==='FINISHED'?'border-green-200':'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {/* Kairė: aikštelė + laikas + etapas */}
                <div className="shrink-0 text-center w-14 cursor-pointer" onClick={()=>openMatch(m)}>
                  {(m as any).matchOrder && <div className="text-xs font-bold text-gray-300">#{(m as any).matchOrder}</div>}
                  {m.court && <div className="text-xs font-medium text-gray-500">A.{m.court}</div>}
                  {m.scheduledAt && <div className="text-xs text-gray-400">{new Date(m.scheduledAt).toLocaleTimeString('lt-LT',{hour:'2-digit',minute:'2-digit'})}</div>}
                  {/* Etapas */}
                  {m.round && (
                    <div className="text-xs font-semibold text-purple-600 mt-0.5 leading-tight">
                      {roundLabel(m.round)}
                    </div>
                  )}
                  {m.group && (
                    <div className="text-xs text-blue-500">Gr.{m.group.name}</div>
                  )}
                </div>

                {/* Komandos */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={()=>openMatch(m)}>
                  <div className={`text-sm font-medium rounded px-1 -mx-1 ${hWin?'text-green-700 bg-green-50':aWin?'text-gray-400':'text-gray-900'}`}>
                    {(m as any).homeTeam?.seedRank && (
                      <span className="text-xs text-gray-400 mr-1 font-normal">#{(m as any).homeTeam.seedRank}</span>
                    )}
                    {hWin && <span className="mr-1">🏆</span>}
                    <span className="truncate">{m.homeTeam?.team.name}</span>
                    {m.homeTeam && ((m as any).homeTeam?.groupWins > 0 || (m as any).homeTeam?.groupLosses > 0) && (
                      <span className="text-xs text-gray-400 ml-1.5 font-normal">
                        {(m as any).homeTeam.groupWins}L/{(m as any).homeTeam.groupLosses}P · {(m as any).homeTeam.groupPoints}t.
                      </span>
                    )}
                  </div>
                  <div className={`text-sm mt-0.5 rounded px-1 -mx-1 ${aWin?'text-green-700 font-medium bg-green-50':hWin?'text-gray-400':'text-gray-600'}`}>
                    {(m as any).awayTeam?.seedRank && (
                      <span className="text-xs text-gray-400 mr-1 font-normal">#{(m as any).awayTeam.seedRank}</span>
                    )}
                    {aWin && <span className="mr-1">🏆</span>}
                    <span className="truncate">{m.awayTeam?.team.name}</span>
                    {m.awayTeam && ((m as any).awayTeam?.groupWins > 0 || (m as any).awayTeam?.groupLosses > 0) && (
                      <span className="text-xs text-gray-400 ml-1.5 font-normal">
                        {(m as any).awayTeam.groupWins}L/{(m as any).awayTeam.groupLosses}P · {(m as any).awayTeam.groupPoints}t.
                      </span>
                    )}
                  </div>
                  {setsStr && <div className="text-xs text-gray-400 mt-1">{setsStr}</div>}
                </div>

                {/* Rezultatas */}
                {m.status==='FINISHED' && (
                  <div className="shrink-0 text-center cursor-pointer" onClick={()=>openMatch(m)}>
                    <span className={`text-lg font-semibold ${hWin?'text-green-700':'text-gray-400'}`}>{hSetsAll}</span>
                    <span className="text-gray-300 mx-1">:</span>
                    <span className={`text-lg font-semibold ${aWin?'text-green-700':'text-gray-400'}`}>{aSetsAll}</span>
                  </div>
                )}

                {/* Dešinė: statusas + mygtukai */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[m.status]}`}>
                    {STATUS_LBL[m.status]}
                  </span>
                  {m.status==='FINISHED' && (
                    <span className="text-xs text-gray-400 cursor-pointer hover:text-gray-600" onClick={()=>openMatch(m)}>✏️ koreguoti</span>
                  )}
                  {/* Atsitiktinis užpildymas šioms rungtynėms */}
                  {m.status !== 'FINISHED' && m.homeTeam && m.awayTeam && (
                    <form
                      method="post"
                      action={`/api/tournaments/${tournamentId}/results/actions`}
                      onSubmit={e => {
                        if (typeof window !== 'undefined') {
                          e.preventDefault()
                          e.stopPropagation()
                          fillOneRandom(m)
                        }
                      }}>
                      <input type="hidden" name="action" value="randomOne" />
                      <input type="hidden" name="isKO" value={isKO ? 'true' : 'false'} />
                      <input type="hidden" name="matchId" value={m.id} />
                      <button
                        type="submit"
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors"
                        title="Užpildyti atsitiktinai">
                        🎲
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
