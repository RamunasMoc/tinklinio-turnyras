'use client'
import { useState } from 'react'
import KnockoutResultsTable from '@/components/shared/KnockoutResultsTable'
import { buildKnockoutStandings } from '@/lib/tournament/knockoutStandings'

const ROUND_LBL: Record<string,string> = {
  R64:'1/32', R32:'1/16', R16:'1/8', LL:'Lucky Loser', QF:'Ketvirtfinaliai',
  SF:'Pusfinaliai', F:'Finalas', '3rd':'Dėl 3 vietos', GF:'Grand Finalas',
  'LB-R1':'LB R1','LB-R2':'LB R2','LB-R3':'LB R3','LB-R4':'LB R4',
  'LB-SF':'LB Pusfin.','LB-F':'LB Finalas',
}

function roundLabel(round: string | null | undefined) {
  if (!round) return ''
  if (/^RR\d+$/.test(round)) return `Apskritasis R${round.slice(2)}`
  return ROUND_LBL[round] ?? round
}

const SINGLE_ROUND_ORDER: Record<string, number> = {
  LL: 0,
  R64: 1,
  R32: 2,
  R16: 3,
  QF: 4,
  SF: 5,
  '3rd': 6,
  F: 7,
  GF: 8,
}

function safeRatio(a:number, b:number) {
  if (b===0) return a===0?1:999
  return a/b
}

function roundOrder(round: string | null | undefined) {
  if (!round) return 99
  if (/^RR\d+$/.test(round)) return Number(round.slice(2))
  return SINGLE_ROUND_ORDER[round] ?? 99
}

function roundRobinStandings(matches: any[]) {
  const rows = new Map<string, any>()
  const ensure = (tt: any) => {
    if (!tt?.id) return null
    if (!rows.has(tt.id)) {
      rows.set(tt.id, {
        id: tt.id,
        seed: tt.seedRank ?? null,
        name: tt.team?.name ?? '',
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        ptsWon: 0,
        ptsLost: 0,
      })
    }
    return rows.get(tt.id)
  }

  for (const m of matches.filter((match: any) => match.round?.startsWith('RR'))) {
    const home = ensure(m.homeTeam)
    const away = ensure(m.awayTeam)
    if (!home || !away || m.status !== 'FINISHED') continue

    const sets = m.sets ?? []
    const hSets = sets.filter((s: any) => s.homeScore > s.awayScore).length || Number(m.homeSets ?? 0)
    const aSets = sets.filter((s: any) => s.awayScore > s.homeScore).length || Number(m.awaySets ?? 0)

    home.played++; away.played++
    home.setsWon += hSets; home.setsLost += aSets
    away.setsWon += aSets; away.setsLost += hSets

    if ((m.winnerId && m.winnerId === m.homeTeamId) || (!m.winnerId && hSets > aSets)) {
      home.wins++; away.losses++
    } else {
      away.wins++; home.losses++
    }

    for (const s of sets.filter((set: any) => !set.isTiebreak)) {
      home.ptsWon += s.homeScore; home.ptsLost += s.awayScore
      away.ptsWon += s.awayScore; away.ptsLost += s.homeScore
    }
  }

  const ratio = (a: number, b: number) => b > 0 ? a / b : (a > 0 ? 999 : 0)
  return [...rows.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const setDiff = ratio(b.setsWon, b.setsLost) - ratio(a.setsWon, a.setsLost)
    if (Math.abs(setDiff) > 0.001) return setDiff
    const pointDiff = ratio(b.ptsWon, b.ptsLost) - ratio(a.ptsWon, a.ptsLost)
    if (Math.abs(pointDiff) > 0.001) return pointDiff
    const diff = (b.ptsWon - b.ptsLost) - (a.ptsWon - a.ptsLost)
    if (diff !== 0) return diff
    return (a.seed ?? 999) - (b.seed ?? 999)
  })
}


// ─── Double Elimination Braket diagrama ──────────────────────

function isNoGameMatch(m: any, allMatches: any[]) {
  if (!m) return true
  if (m.status === 'FINISHED' && (!m.homeTeamId || !m.awayTeamId)) return true
  if (m.round === 'LB-R1') {
    const firstRound = allMatches.some((candidate: any) => candidate.round === 'R16') ? 'R16' : 'QF'
    const sourceNumbers = [(m.matchNumber ?? 1) * 2 - 1, (m.matchNumber ?? 1) * 2]
    const realSources = sourceNumbers.filter(n => {
      const source = allMatches.find((candidate: any) => candidate.round === firstRound && candidate.matchNumber === n)
      return source?.homeTeamId && source?.awayTeamId
    }).length
    return realSources < 2
  }
  if (m.round === 'LB-R2') {
    const lbR1 = allMatches.find((candidate: any) =>
      candidate.round === 'LB-R1' && candidate.matchNumber === m.matchNumber
    )
    if (lbR1) {
      const firstRound = allMatches.some((candidate: any) => candidate.round === 'R16') ? 'R16' : 'QF'
      const sourceNumbers = [(lbR1.matchNumber ?? 1) * 2 - 1, (lbR1.matchNumber ?? 1) * 2]
      const realSources = sourceNumbers.filter(n => {
        const source = allMatches.find((candidate: any) => candidate.round === firstRound && candidate.matchNumber === n)
        return source?.homeTeamId && source?.awayTeamId
      }).length
      return realSources === 0
    }
  }
  return false
}

function MatchBox({ m, matchNum, allMatches = [] }: { m: any; matchNum: number | null; allMatches?: any[] }) {
  const hSetsWon = (m.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length
  const aSetsWon = (m.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length
  const hW = m.status==='FINISHED' && (m.winnerId ? m.winnerId===m.homeTeamId : hSetsWon>aSetsWon)
  const aW = m.status==='FINISHED' && (m.winnerId ? m.winnerId===m.awayTeamId : aSetsWon>hSetsWon)
  const hName = m.homeTeam?.team?.name
  const aName = m.awayTeam?.team?.name
  const hSeed = m.homeTeam?.seedRank
  const aSeed = m.awayTeam?.seedRank
  const finished = m.status === 'FINISHED'
  const noGame = isNoGameMatch(m, allMatches)
  const border = noGame ? 'border-red-300' : finished ? 'border-green-300' : m.status==='IN_PROGRESS' ? 'border-red-300' : 'border-gray-200'

  return (
    <div className={`border rounded-lg overflow-hidden text-xs ${border} ${noGame ? 'bg-red-50' : 'bg-white'}`} style={{minWidth:'160px'}}>
      {matchNum && (
        <div className="px-2 py-0.5 bg-gray-50 border-b border-gray-100 text-gray-400 text-center" style={{fontSize:'10px'}}>
          {matchNum} Rungtynės{noGame && <span className="ml-1 text-red-500">· nėra rungt.</span>}
        </div>
      )}
      <div className={`flex items-center gap-1 px-2 py-1 ${hW?'bg-green-50 font-semibold text-green-800':'text-gray-600'} border-b border-gray-100`}>
        {hSeed && <span className="text-gray-400 w-4 text-right shrink-0">{hSeed}</span>}
        <span className="flex-1 truncate">{hName ?? <span className={noGame ? 'text-red-300 italic' : 'text-gray-300 italic'}>{noGame ? 'Nėra rungtynių' : 'TBD'}</span>}</span>
        {finished && <span className={`font-bold shrink-0 ${hW?'text-green-700':'text-gray-300'}`}>{hSetsWon}</span>}
      </div>
      <div className={`flex items-center gap-1 px-2 py-1 ${aW?'bg-green-50 font-semibold text-green-800':'text-gray-600'}`}>
        {aSeed && <span className="text-gray-400 w-4 text-right shrink-0">{aSeed}</span>}
        <span className="flex-1 truncate">{aName ?? <span className={noGame ? 'text-red-300 italic' : 'text-gray-300 italic'}>{noGame ? 'Nėra rungtynių' : 'TBD'}</span>}</span>
        {finished && <span className={`font-bold shrink-0 ${aW?'text-green-700':'text-gray-300'}`}>{aSetsWon}</span>}
      </div>
      {(m.court || m.scheduledAt) && (
        <div className="px-2 py-0.5 border-t border-gray-100 flex justify-between text-gray-400" style={{fontSize:'10px'}}>
          <span>{m.court ? `A.${m.court}` : '—'}</span>
          <span>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('lt-LT',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
        </div>
      )}
    </div>
  )
}

function RoundCol({ label, matchNums, allMatches }: { label: string; matchNums: number[]; allMatches: any[] }) {
  const ms = matchNums.map(n => allMatches.find((m:any) => (m as any).matchOrder === n)).filter(Boolean)
  return (
    <div className="shrink-0" style={{minWidth:'175px'}}>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-2">{label}</div>
      <div className="flex flex-col gap-2">
        {ms.map((m:any) => <MatchBox key={m.id} m={m} matchNum={(m as any).matchOrder} allMatches={allMatches} />)}
        {ms.length === 0 && matchNums.map(n => (
          <div key={n} className="border border-gray-200 rounded-lg bg-white text-xs" style={{minWidth:'160px'}}>
            <div className="px-2 py-0.5 bg-gray-50 border-b border-gray-100 text-gray-400 text-center" style={{fontSize:'10px'}}>{n} Rungtynės</div>
            <div className="px-2 py-1 text-gray-300 italic">TBD</div>
            <div className="px-2 py-1 text-gray-300 italic border-t border-gray-100">TBD</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DEBracket({ matches }: { matches: any[] }) {
  // Nustatyti ar 12 komandų (be WB-F) ar 16 komandų (su WB-F)
  const hasF    = matches.some((m:any) => m.round === 'F')
  const hasLBF  = matches.some((m:any) => m.round === 'LB-F')
  const hasLBSF = matches.some((m:any) => m.round === 'LB-SF')
  const n12 = !hasF && hasLBSF  // 12 komandų schema

  // Suskaičiuoti mačų kiekius kiekviename raunde
  const cnt = (r:string) => matches.filter((m:any) => m.round === r).length
  const R16count = cnt('R16')
  const QFcount  = cnt('QF')
  const SFcount  = cnt('SF')

  if (n12) {
    // 12 komandų schema: WB[R16,QF,SF] + LB[LB-R1..LB-SF] + [3rd,GF]
    // Numeracija pagal schemą: 1-4,5-8,9-10,11-14,15-16,17-18,19-20,21,22
    const r16nums   = Array.from({length:R16count}, (_,i)=>i+1)
    const qfnums    = Array.from({length:QFcount},  (_,i)=>i+1+R16count)
    const lbr1nums  = [R16count+QFcount+1, R16count+QFcount+2]
    const lbr2start = R16count+QFcount+3
    const lbr2nums  = Array.from({length:4}, (_,i)=>lbr2start+i)
    const sfstart   = lbr2start+4
    const sfnums    = [sfstart, sfstart+1]
    const lbr3nums  = [sfstart+2, sfstart+3]
    const lbr4nums  = [sfstart+4, sfstart+5]
    const thirdnum  = sfstart+6
    const gfnum     = sfstart+7

    return (
      <div className="overflow-x-auto">
        <div className="min-w-max pb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Winners Bracket</div>
          <div className="flex gap-4 mb-6">
            <RoundCol label="1/8" matchNums={r16nums} allMatches={matches} />
            <RoundCol label="Ketvirtfinaliai" matchNums={qfnums} allMatches={matches} />
            <RoundCol label="Pusfinaliai" matchNums={sfnums} allMatches={matches} />
          </div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Losers Bracket</div>
          <div className="flex gap-4 mb-6">
            <RoundCol label="LB R1" matchNums={lbr1nums} allMatches={matches} />
            <RoundCol label="LB R2" matchNums={lbr2nums} allMatches={matches} />
            <RoundCol label="LB R3" matchNums={lbr3nums} allMatches={matches} />
            <RoundCol label="LB R4 / Pusfinaliai" matchNums={lbr4nums} allMatches={matches} />
          </div>
          <div className="flex gap-4">
            <RoundCol label="Mažasis Finalas" matchNums={[thirdnum]} allMatches={matches} />
            <RoundCol label="Didysis Finalas" matchNums={[gfnum]} allMatches={matches} />
          </div>
        </div>
      </div>
    )
  }

  // Standartinis DE (16+ komandų)
  const wbRounds = [...new Set(matches.filter((m:any)=>!m.round.startsWith('LB')&&m.round!=='GF'&&m.round!=='3rd').map((m:any)=>m.round))]
  const lbRounds = [...new Set(matches.filter((m:any)=>m.round.startsWith('LB')).map((m:any)=>m.round))]
  const ROUND_LBL2: Record<string,string> = {
    R16:'1/8', QF:'Ketvirtfinaliai', SF:'Pusfinaliai', F:'Finalas',
    'LB-R1':'LB R1','LB-R2':'LB R2','LB-R3':'LB R3','LB-R4':'LB R4',
    'LB-SF':'LB Pusfin.','LB-F':'LB Finalas',
  }
  const getMatchNums = (r:string) => matches.filter((m:any)=>m.round===r).map((m:any)=>(m as any).matchOrder).filter(Boolean).sort((a:number,b:number)=>a-b)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max pb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Winners Bracket</div>
        <div className="flex gap-4 mb-6">
          {wbRounds.map(r => <RoundCol key={r} label={ROUND_LBL2[r]??r} matchNums={getMatchNums(r)} allMatches={matches} />)}
        </div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Losers Bracket</div>
        <div className="flex gap-4 mb-6">
          {lbRounds.map(r => <RoundCol key={r} label={ROUND_LBL2[r]??r} matchNums={getMatchNums(r)} allMatches={matches} />)}
        </div>
        {matches.some((m:any)=>m.round==='GF') && (
          <div className="flex gap-4">
            {matches.some((m:any)=>m.round==='3rd') && <RoundCol label="Dėl 3 vietos" matchNums={getMatchNums('3rd')} allMatches={matches} />}
            <RoundCol label="Grand Finalas" matchNums={getMatchNums('GF')} allMatches={matches} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ExampleDEBracket({ matches }: { matches: any[] }) {
  const byRoundNumber = (round: string, matchNumber: number) =>
    matches.find((m: any) => m.round === round && m.matchNumber === matchNumber)

  function getMatch(round: string, matchNumber: number) {
    return byRoundNumber(round, matchNumber)
  }

  function displayOrder(round: string, matchNumber: number, fallback: number) {
    const m = getMatch(round, matchNumber)
    return (m as any)?.matchOrder ?? fallback
  }

  function teamWonMatch(prev: any, teamId: string) {
    if (prev.winnerId) return prev.winnerId === teamId
    const hSetsWon = (prev.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length
    const aSetsWon = (prev.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length
    if (hSetsWon !== aSetsWon) {
      return prev.homeTeamId === teamId ? hSetsWon > aSetsWon : aSetsWon > hSetsWon
    }
    if (prev.homeSets !== null && prev.awaySets !== null && prev.homeSets !== prev.awaySets) {
      return prev.homeTeamId === teamId ? prev.homeSets > prev.awaySets : prev.awaySets > prev.homeSets
    }
    return null
  }

  function latestTeamSource(m: any, teamId?: string | null) {
    if (!teamId || !m?.matchOrder) return null
    const prev = [...matches]
      .filter((candidate: any) =>
        candidate.id !== m.id &&
        candidate.matchOrder &&
        candidate.matchOrder < m.matchOrder &&
        (candidate.homeTeamId === teamId || candidate.awayTeamId === teamId)
      )
      .sort((a: any, b: any) => ((b.matchOrder ?? 0) - (a.matchOrder ?? 0)))[0]
    if (!prev) return null
    const won = teamWonMatch(prev, teamId)
    if (won === null) return null
    return `${won ? 'W' : 'L'}${prev.matchOrder}`
  }

  function fallbackSourceLabel(m: any, slot: 'home' | 'away') {
    if (!m?.round || m.round === 'R16') return null
    const mn = m.matchNumber ?? 1
    const isEightTeamSheet = matches.some((candidate: any) => candidate.round === 'QF') && !matches.some((candidate: any) => candidate.round === 'R16')
    const swapPair = (n: number) => n % 2 === 1 ? n + 1 : n - 1
    const from = (type: 'W' | 'L', round: string, matchNumber: number, fallback: number) =>
      `${type}${displayOrder(round, matchNumber, fallback)}`

    if (m.round === 'QF') {
      return slot === 'home'
        ? from('W', 'R16', mn * 2 - 1, mn * 2 - 1)
        : from('W', 'R16', mn * 2, mn * 2)
    }
    if (m.round === 'SF') {
      return slot === 'home'
        ? from('W', 'QF', mn * 2 - 1, isEightTeamSheet ? mn * 2 - 1 : 8 + mn * 2 - 1)
        : from('W', 'QF', mn * 2, isEightTeamSheet ? mn * 2 : 8 + mn * 2)
    }
    if (m.round === 'F') {
      return slot === 'home'
        ? from('W', 'SF', 1, isEightTeamSheet ? 7 : 21)
        : from('W', 'SF', 2, isEightTeamSheet ? 8 : 22)
    }
    if (m.round === '3rd') {
      const hasLbFinal = matches.some((candidate: any) => candidate.round === 'LB-F')
      if (hasLbFinal) {
        return slot === 'home'
          ? from('L', 'LB-SF', 1, isEightTeamSheet ? 11 : 26)
          : from('L', 'LB-F', 1, isEightTeamSheet ? 13 : 28)
      }
      return slot === 'home'
        ? from('L', 'SF', 1, 21)
        : from('L', 'SF', 2, 22)
    }
    if (m.round === 'GF') {
      return slot === 'home'
        ? from('W', 'F', 1, isEightTeamSheet ? 12 : 28)
        : from('W', 'LB-F', 1, isEightTeamSheet ? 13 : 29)
    }
    if (m.round === 'LB-R1') {
      const dropRound = isEightTeamSheet ? 'QF' : 'R16'
      return slot === 'home'
        ? from('L', dropRound, mn * 2 - 1, mn * 2 - 1)
        : from('L', dropRound, mn * 2, mn * 2)
    }
    if (m.round === 'LB-R2') {
      const sourceMatch = swapPair(mn)
      return slot === 'home'
        ? from('W', 'LB-R1', mn, isEightTeamSheet ? 4 + mn : 12 + mn)
        : from('L', isEightTeamSheet ? 'SF' : 'QF', sourceMatch, isEightTeamSheet ? 6 + sourceMatch : 8 + sourceMatch)
    }
    if (m.round === 'LB-R3') {
      return slot === 'home'
        ? from('W', 'LB-R2', mn * 2 - 1, 16 + mn * 2 - 1)
        : from('W', 'LB-R2', mn * 2, 16 + mn * 2)
    }
    if (m.round === 'LB-R4') {
      const sourceMatch = swapPair(mn)
      return slot === 'home'
        ? from('W', 'LB-R3', mn, 22 + mn)
        : from('L', 'SF', sourceMatch, 20 + sourceMatch)
    }
    if (m.round === 'LB-SF') {
      return slot === 'home'
        ? from('W', isEightTeamSheet ? 'LB-R2' : 'LB-R4', 1, isEightTeamSheet ? 9 : 25)
        : from('W', isEightTeamSheet ? 'LB-R2' : 'LB-R4', 2, isEightTeamSheet ? 10 : 27)
    }
    if (m.round === 'LB-F') {
      return slot === 'home'
        ? from('W', 'LB-SF', 1, isEightTeamSheet ? 11 : 26)
        : from('L', 'F', 1, isEightTeamSheet ? 12 : 28)
    }
    return null
  }

  function sourceLabel(m: any, slot: 'home' | 'away') {
    const teamId = slot === 'home' ? m?.homeTeamId : m?.awayTeamId
    if (m?.round === '3rd') return fallbackSourceLabel(m, slot)
    return latestTeamSource(m, teamId) ?? fallbackSourceLabel(m, slot)
  }

  function BracketCard({ m, label, muted = false }: { m: any; label?: string; muted?: boolean }) {
    const noGame = isNoGameMatch(m, matches)
    if (!m) {
      return (
        <div className="border border-dashed border-red-300 rounded-lg bg-red-50 text-xs overflow-hidden">
          <div className="px-2 py-1 bg-red-50 border-b border-red-100 text-red-400 text-center">
            {label ?? 'TBD'} Rungtynės · nėra rungt.
          </div>
          <div className="px-2 py-2 text-red-300 italic">Nėra rungtynių</div>
          <div className="px-2 py-2 text-red-300 italic border-t border-red-100">Nėra rungtynių</div>
          <div className="px-2 py-1 border-t border-red-100 flex justify-between text-red-300">
            <span>—</span><span>—</span>
          </div>
        </div>
      )
    }
    const hSetsWon = (m.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length
    const aSetsWon = (m.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length
    const hW = m.status==='FINISHED' && (m.winnerId ? m.winnerId===m.homeTeamId : hSetsWon>aSetsWon)
    const aW = m.status==='FINISHED' && (m.winnerId ? m.winnerId===m.awayTeamId : aSetsWon>hSetsWon)
    const hName = m.homeTeam?.team?.name
    const aName = m.awayTeam?.team?.name
    const hSeed = m.homeTeam?.seedRank
    const aSeed = m.awayTeam?.seedRank
    const finished = m.status === 'FINISHED'
    const order = (m as any).matchOrder ?? label
    const border = noGame ? 'border-red-300' : finished ? 'border-green-300' : m.status==='IN_PROGRESS' ? 'border-red-300' : 'border-gray-200'
    const hSource = sourceLabel(m, 'home')
    const aSource = sourceLabel(m, 'away')

    return (
      <div className={`border rounded-lg overflow-hidden text-xs shadow-sm ${border} ${noGame ? 'bg-red-50' : 'bg-white'} ${muted ? 'opacity-80' : ''}`}>
        <div className={`px-2 py-1 border-b text-center ${noGame ? 'bg-red-50 border-red-100 text-red-400' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
          <span className="font-medium">{order} Rungtynės</span>
          {m.round && <span className="ml-1 text-purple-500">· {roundLabel(m.round)}</span>}
          {noGame && <span className="ml-1 text-red-500">· nėra rungt.</span>}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1.5 ${hW?'bg-green-50 font-semibold text-green-800':'text-gray-600'} border-b border-gray-100`}>
          {hSeed && <span className="text-gray-400 w-5 text-right shrink-0">{hSeed}</span>}
          <span className="flex-1 min-w-0 truncate">
            {hName ?? <span className={noGame ? 'text-red-300 italic' : 'text-gray-300 italic'}>{noGame ? 'Nėra rungtynių' : 'TBD'}</span>}
            {hSource && <span className="ml-1 text-gray-400 font-normal">({hSource})</span>}
          </span>
          {finished && <span className={`font-bold shrink-0 ${hW?'text-green-700':'text-gray-300'}`}>{hSetsWon}</span>}
        </div>
        <div className={`flex items-center gap-1 px-2 py-1.5 ${aW?'bg-green-50 font-semibold text-green-800':'text-gray-600'}`}>
          {aSeed && <span className="text-gray-400 w-5 text-right shrink-0">{aSeed}</span>}
          <span className="flex-1 min-w-0 truncate">
            {aName ?? <span className={noGame ? 'text-red-300 italic' : 'text-gray-300 italic'}>{noGame ? 'Nėra rungtynių' : 'TBD'}</span>}
            {aSource && <span className="ml-1 text-gray-400 font-normal">({aSource})</span>}
          </span>
          {finished && <span className={`font-bold shrink-0 ${aW?'text-green-700':'text-gray-300'}`}>{aSetsWon}</span>}
        </div>
        <div className={`px-2 py-1 border-t flex justify-between ${noGame ? 'border-red-100 text-red-300' : 'border-gray-100 text-gray-400'}`}>
          <span>{m.court ? `A.${m.court}` : '—'}</span>
          <span>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('lt-LT',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
        </div>
      </div>
    )
  }

  function Column({ title, items, className = '', gap = 'space-y-4' }: { title: string; items: any[]; className?: string; gap?: string }) {
    return (
      <div className={`w-72 shrink-0 ${className}`}>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">{title}</div>
        <div className={gap}>
          {items.map((item, i) => (
            <BracketCard key={`${title}-${i}`} m={item.m} label={item.label} muted={item.muted} />
          ))}
        </div>
      </div>
    )
  }

  function existingItem(round: string, matchNumber: number, label: string) {
    const m = getMatch(round, matchNumber)
    return m ? { m, label } : null
  }

  function existingItems(items: ({ m: any; label: string } | null)[]) {
    return items.filter(Boolean) as { m: any; label: string }[]
  }

  const isEightTeamSheet = matches.some((m: any) => m.round === 'QF') && !matches.some((m: any) => m.round === 'R16')
  if (isEightTeamSheet) {
    const wbQF8 = existingItems(Array.from({ length: 4 }, (_, i) => existingItem('QF', i + 1, String(i + 1))))
    const wbSF8 = existingItems(Array.from({ length: 2 }, (_, i) => existingItem('SF', i + 1, String(7 + i))))
    const lbR1Eight = existingItems([2, 1].map((n, i) => existingItem('LB-R1', n, String(6 - i))))
    const lbR2Eight = existingItems([2, 1].map((n, i) => existingItem('LB-R2', n, String(10 - i))))
    const finalsEight = existingItems([
      existingItem('LB-SF', 1, '11'),
      existingItem('F', 1, '12'),
      existingItem('LB-F', 1, '13'),
      existingItem('GF', 1, '14'),
      existingItem('3rd', 1, '15'),
    ])

    return (
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Atkrintamųjų tinklelis</div>
        <div className="overflow-x-auto">
          <div className="min-w-[1500px] pb-4">
            <div className="flex items-start gap-8">
              <Column title="Ketvirtfinaliai" items={wbQF8} gap="space-y-5" />
              <Column title="Pusfinaliai" items={wbSF8} className="pt-16" gap="space-y-[149px]" />
              <Column title="Finalai" items={finalsEight} className="pt-24" gap="space-y-6" />
              <Column title="LB R2" items={lbR2Eight} className="pt-32" gap="space-y-24" />
              <Column title="LB R1" items={lbR1Eight} className="pt-20" gap="space-y-16" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const wbR16 = existingItems(Array.from({ length: 8 }, (_, i) => existingItem('R16', i + 1, String(i + 1))))
  const wbQF = existingItems(Array.from({ length: 4 }, (_, i) => existingItem('QF', i + 1, String(9 + i))))
  const wbSF = existingItems(Array.from({ length: 2 }, (_, i) => existingItem('SF', i + 1, String(23 + i))))
  const lbR1 = existingItems([4,3,2,1].map((n, i) => existingItem('LB-R1', n, String(12 - i))))
  const lbR2 = existingItems([4,3,2,1].map((n, i) => existingItem('LB-R2', n, String(17 + i))))
  const lbR3 = existingItems(Array.from({ length: 2 }, (_, i) => existingItem('LB-R3', i + 1, String(21 + i))))
  const lbSemi = existingItems([existingItem('LB-SF', 1, '26')])
  const lbLate = existingItems([
    existingItem('LB-R4', 1, '25'),
    existingItem('LB-R4', 2, '27'),
  ])
  const finals = existingItems([
    existingItem('F', 1, '27'),
    existingItem('LB-F', 1, '28'),
    existingItem('3rd', 1, '29'),
    existingItem('GF', 1, '30'),
  ])

  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Atkrintamųjų tinklelis</div>
      <div className="overflow-x-auto">
        <div className="min-w-[2320px] pb-4">
          <div className="flex items-start gap-8">
            <Column title="1/8" items={wbR16} gap="space-y-5" />
            <Column title="Ketvirtfinaliai" items={wbQF} className="pt-16" gap="space-y-[149px]" />
            <Column title="Pusfinaliai" items={wbSF} className="pt-[193px]" gap="space-y-[408px]" />
            <Column title="Finalai" items={finals} className="pt-24" gap="space-y-6" />
            <Column title="LB Pusfin." items={lbSemi} className="pt-52" />
            <Column title="LB Vėlyvas etapas" items={lbLate} className="pt-52" gap="space-y-32" />
            <Column title="LB R3" items={lbR3} className="pt-40" gap="space-y-56" />
            <Column title="LB R2" items={lbR2} className="pt-10" gap="space-y-7" />
            <Column title="LB R1" items={lbR1} className="pt-16" gap="space-y-8" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function KnockoutClient({ tournamentId, config, initialMatches, qualifiedTeams, groupsWithMatches = [] }:
  { tournamentId:string; config:any; initialMatches:any[]; qualifiedTeams:any[]; groupsWithMatches?:any[] }) {

  const [matches,  setMatches]  = useState<any[]>(initialMatches)
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')

  // ─── Apskaičiuoti kas patenka į atkrintamąsias pagal grupių rezultatus ───
  const advMode     = config?.advanceMode ?? 'fixed'
  const advPerGroup = config?.advancePerGroup ?? 2
  const advTotal    = config?.advanceTotal ?? 8
  const luckyLoserDirectPositions = Math.max(1, Number(advPerGroup ?? 2))
  // Braket sugeneruotas: naudoti seedRank iš DB (jis sutampa su braket pozicijomis)
  const hasBracket  = matches.length > 0

  // Surūšiuoti komandas grupėse pagal FIVB taisykles
  function headToHeadOrder(a: any, b: any, teams: any[], groupMatches: any[] = []) {
    const aPts = Number(a.groupPoints ?? 0)
    const bPts = Number(b.groupPoints ?? 0)
    const samePoints = teams.filter(t => Number(t.groupPoints ?? 0) === aPts)
    if (aPts !== bPts || samePoints.length !== 2) return 0

    const match = groupMatches.find((m: any) =>
      m.status === 'FINISHED' &&
      ((m.homeTeamId === a.id && m.awayTeamId === b.id) ||
       (m.homeTeamId === b.id && m.awayTeamId === a.id))
    )
    if (!match?.winnerId) return 0
    if (match.winnerId === a.id) return -1
    if (match.winnerId === b.id) return 1
    return 0
  }

  function sortGroup(teams: any[], groupMatches: any[] = []) {
    return [...teams].sort((a,b) => {
      const aPts = Number(a.groupPoints??0), bPts = Number(b.groupPoints??0)
      const aW   = Number(a.groupWins??0),   bW   = Number(b.groupWins??0)
      if (bPts !== aPts) return bPts - aPts
      const h2h = headToHeadOrder(a, b, teams, groupMatches)
      if (h2h !== 0) return h2h
      if (bW   !== aW)   return bW   - aW
      const asr = safeRatio(Number(a.groupSetsWon??0), Number(a.groupSetsLost??0))
      const bsr = safeRatio(Number(b.groupSetsWon??0), Number(b.groupSetsLost??0))
      if (Math.abs(bsr-asr) > 0.001) return bsr - asr
      const apr = safeRatio(Number(a.groupPtsWon??0), Number(a.groupPtsLost??0))
      const bpr = safeRatio(Number(b.groupPtsWon??0), Number(b.groupPtsLost??0))
      if (Math.abs(bpr-apr) > 0.001) return bpr - apr
      return (Number(b.groupPtsWon??0)-Number(b.groupPtsLost??0)) - (Number(a.groupPtsWon??0)-Number(a.groupPtsLost??0))
    })
  }

  // Grupuoti qualifiedTeams pagal grupę ir surikiuoti kiekvieną grupę pagal FIVB
  // Naudojame tik qualifiedTeams - jis visada turi teisingą statistiką
  const byGroup: Record<string, any[]> = {}
  for (const tt of qualifiedTeams) {
    const gName = tt.group?.name ?? '?'
    if (!byGroup[gName]) byGroup[gName] = []
    byGroup[gName].push(tt)
  }

  // groupsWithMatches naudojamas tik FIVB korekcijai
  const matchesByGroup: Record<string, any[]> = {}
  for (const g of groupsWithMatches) {
    matchesByGroup[(g as any).name] = (g as any).matches ?? []
  }

  // Rikiuoti grupes pagal raidę (A, B, C, D...)
  const sortedGroups = Object.entries(byGroup)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([name, teams]) => {
      const groupMatches = matchesByGroup[name] ?? []
      return {
        name,
        matches: groupMatches,
        teams:   sortGroup(teams, groupMatches),
      }
    })

  function compareSamePosition(a: { team:any; group:string }, b: { team:any; group:string }) {
    const ta = a.team, tb = b.team
    const taPts  = Number(ta.groupPoints ?? 0), tbPts  = Number(tb.groupPoints ?? 0)
    const taWins = Number(ta.groupWins   ?? 0), tbWins = Number(tb.groupWins   ?? 0)
    const asr = safeRatio(Number(ta.groupSetsWon??0), Number(ta.groupSetsLost??0))
    const bsr = safeRatio(Number(tb.groupSetsWon??0), Number(tb.groupSetsLost??0))
    const apr = safeRatio(Number(ta.groupPtsWon??0), Number(ta.groupPtsLost??0))
    const bpr = safeRatio(Number(tb.groupPtsWon??0), Number(tb.groupPtsLost??0))

    if (config?.groupPointSystem === 'SET_RATIO') {
      if (Math.abs(bsr-asr) > 0.001) return bsr - asr
      if (Math.abs(bpr-apr) > 0.001) return bpr - apr
      const aDiff = Number(ta.groupPtsWon??0)-Number(ta.groupPtsLost??0)
      const bDiff = Number(tb.groupPtsWon??0)-Number(tb.groupPtsLost??0)
      if (bDiff !== aDiff) return bDiff - aDiff
      return a.group.localeCompare(b.group)
    }

    if (tbPts  !== taPts)  return tbPts  - taPts
    if (tbWins !== taWins) return tbWins - taWins
    if (Math.abs(bsr-asr) > 0.001) return bsr - asr
    if (Math.abs(bpr-apr) > 0.001) return bpr - apr
    return a.group.localeCompare(b.group)
  }

  // Sudaryti kvalifikuotų komandų sąrašą su pozicijomis
  const qualified: { team:any; group:string; pos:number; seed:number }[] = []

  if (advMode === 'fixed') {
    // Pirma visi 1-ieji, tada visi 2-ieji ir t.t.
    // Vienodų pozicijų komandos rikiuojamos pagal statistiką (FIVB)
    for (let pos = 0; pos < advPerGroup; pos++) {
      const samePos = sortedGroups
        .filter(g => g.teams[pos])
        .map(g => ({ team: g.teams[pos], group: g.name }))
        .sort(compareSamePosition)
      for (const { team, group } of samePos) {
        qualified.push({ team, group, pos: pos+1, seed: qualified.length+1 })
      }
    }
  } else {
    // Tiesioginiai - rikiuoti pagal statistiką (kaip fixed režime)
    for (let pos = 0; pos < advPerGroup; pos++) {
      const samePos = sortedGroups
        .filter(g => g.teams[pos])
        .map(g => ({ team: g.teams[pos], group: g.name }))
        .sort(compareSamePosition)
      for (const { team, group } of samePos) {
        qualified.push({ team, group, pos: pos+1, seed: qualified.length+1 })
      }
    }
    // Wild card — geriausios likusios (n+1 pozicija iš kiekvienos grupės)
    // FIVB korekcija: kai grupės nevienodo dydžio, lyginimui naudojami tik
    // rezultatai prieš komandas iki minGroupSize pozicijos (neįskaitant paskutinių)
    const minGroupSize = Math.min(...sortedGroups.map(g => g.teams.length))

    // Funkcija kuri apskaičiuoja koreguotą statistiką pagal FIVB
    function calcAdjustedStats(tt: any, g: any): { pts:number; setR:number; ptR:number } {
      // Jei grupė yra minimalaus dydžio — naudoti pilną statistiką
      if (g.teams.length <= minGroupSize) {
        return {
          pts:  tt.groupPoints,
          setR: safeRatio(tt.groupSetsWon, tt.groupSetsLost),
          ptR:  safeRatio(tt.groupPtsWon, tt.groupPtsLost),
        }
      }
      // Grupė didesnė — reikia atimti rezultatus prieš paskutines komandas
      // Paskutinės komandos = komandos nuo minGroupSize pozicijos
      // (rikiuotos pagal grupių lentelę)
      const excludedTeamIds = new Set(
        g.teams.slice(minGroupSize).map((t: any) => t.id)
      )
      // Perskaičiuoti statistiką be šių komandų
      let wins=0, losses=0, points=0, setsWon=0, setsLost=0, ptsWon=0, ptsLost=0
      for (const m of (g.matches ?? [])) {
        if (m.status !== 'FINISHED') continue
        const isHome = m.homeTeamId === tt.id
        const isAway = m.awayTeamId === tt.id
        if (!isHome && !isAway) continue
        const oppId = isHome ? m.awayTeamId : m.homeTeamId
        if (excludedTeamIds.has(oppId)) continue // praleisti mačus su išskirtomis
        const allSets = m.sets ?? []
        const hSetsAll = allSets.filter((s:any) => s.homeScore > s.awayScore).length
        const aSetsAll = allSets.filter((s:any) => s.awayScore > s.homeScore).length
        const hw = m.winnerId ? m.winnerId === m.homeTeamId : (m.homeSets ?? 0) > (m.awaySets ?? 0)
        if (isHome) {
          wins    += hw ? 1 : 0;  losses  += hw ? 0 : 1
          setsWon += hSetsAll;    setsLost+= aSetsAll
          for (const s of allSets.filter((s:any) => !s.isTiebreak)) {
            ptsWon += s.homeScore; ptsLost += s.awayScore
          }
          if (config?.groupPointSystem === 'SET_RATIO') points += hSetsAll
          else if (config?.groupPointSystem === 'TWO_ONE') points += hw ? 2 : 1
          else points += hw ? 1 : 0
        } else {
          wins    += hw ? 0 : 1;  losses  += hw ? 1 : 0
          setsWon += aSetsAll;    setsLost+= hSetsAll
          for (const s of allSets.filter((s:any) => !s.isTiebreak)) {
            ptsWon += s.awayScore; ptsLost += s.homeScore
          }
          if (config?.groupPointSystem === 'SET_RATIO') points += aSetsAll
          else if (config?.groupPointSystem === 'TWO_ONE') points += hw ? 1 : 2
          else points += hw ? 0 : 1
        }
      }
      return {
        pts:  points,
        setR: safeRatio(setsWon, setsLost),
        ptR:  safeRatio(ptsWon, ptsLost),
      }
    }

    const wildcards: { team:any; group:string; pos:number; pts:number; setR:number; ptR:number }[] = []
    for (const g of sortedGroups) {
      const tt = g.teams[advPerGroup]
      if (tt) {
        const adj = calcAdjustedStats(tt, g)
        wildcards.push({
          team: tt, group: g.name, pos: advPerGroup+1,
          pts:  adj.pts,
          setR: adj.setR,
          ptR:  adj.ptR,
        })
      }
    }
    // Rūšiuoti wild card pagal FIVB (koreguota statistika)
    wildcards.sort((a,b) => {
      if (config?.groupPointSystem === 'SET_RATIO') {
        if (Math.abs(b.setR-a.setR)>0.001) return b.setR - a.setR
        if (Math.abs(b.ptR-a.ptR)>0.001) return b.ptR - a.ptR
        return a.group.localeCompare(b.group)
      }
      if (b.pts !== a.pts) return b.pts - a.pts
      if (Math.abs(b.setR-a.setR)>0.001) return b.setR - a.setR
      return b.ptR - a.ptR
    })
    const needed = advTotal - qualified.length
    for (let i=0; i<needed && i<wildcards.length; i++) {
      qualified.push({ team: wildcards[i].team, group: wildcards[i].group, pos: wildcards[i].pos, seed: qualified.length+1 })
    }
  }

  if (config?.knockoutFormat === 'LUCKY_LOSER') {
    const lucky: { team:any; group:string; pos:number; seed:number }[] = []
    const directPositions = Math.max(1, Number(advPerGroup ?? 2))

    for (let pos = 0; pos < directPositions; pos++) {
      const samePos = sortedGroups
        .filter(g => g.teams[pos])
        .map(g => ({ team: g.teams[pos], group: g.name }))
        .sort(compareSamePosition)
      for (const { team, group } of samePos) {
        lucky.push({ team, group, pos: pos+1, seed: lucky.length+1 })
      }
    }

    const totalTarget = advMode === 'total' ? Math.max(lucky.length, advTotal) : lucky.length + sortedGroups.length
    for (let pos = directPositions; lucky.length < totalTarget; pos++) {
      const samePos = sortedGroups
        .filter(g => g.teams[pos])
        .map(g => ({ team: g.teams[pos], group: g.name }))
        .sort(compareSamePosition)
      if (samePos.length === 0) break
      for (const { team, group } of samePos) {
        if (lucky.length >= totalTarget) break
        lucky.push({ team, group, pos: pos+1, seed: lucky.length+1 })
      }
    }

    qualified.splice(0, qualified.length, ...lucky)
  }

  const hasGroupResults = qualifiedTeams.some(tt =>
    tt.groupWins > 0 || tt.groupLosses > 0
  )

  const firstBracketRound = matches.some((m: any) => m.round === 'R16')
    ? 'R16'
    : matches.some((m: any) => m.round === 'QF')
      ? 'QF'
      : matches[0]?.round
  const bracketTeamIds = new Set(
    matches
      .filter((m: any) => ['ROUND_ROBIN', 'LUCKY_LOSER'].includes(config?.knockoutFormat) || m.round === firstBracketRound)
      .flatMap((m: any) => [m.homeTeamId, m.awayTeamId])
      .filter(Boolean)
  )
  const qualifiedTeamIds = new Set(qualified.map(q => q.team.id))
  const bracketOutOfSync = matches.length > 0 && qualified.length > 0 && (
    bracketTeamIds.size !== qualifiedTeamIds.size ||
    [...qualifiedTeamIds].some(id => !bracketTeamIds.has(id))
  )

  async function clearKO() {
    if (!confirm('Išvalyti visus atkrintamųjų mačus ir braket?')) return
    setLoading(true)
    await fetch(`/api/tournaments/${tournamentId}/knockout/clear`, { method: 'POST' })
    setLoading(false)
    window.location.reload()
  }

  async function generate() {
    setLoading(true); setMsg('')
    const res  = await fetch(`/api/tournaments/${tournamentId}/knockout`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'generate' }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) window.location.reload()
    else setMsg(`Klaida: ${data.error}`)
  }

  const rounds = [...new Set(matches.map(m => m.round))].filter(Boolean)
  const isWB   = (r:string) => !r.startsWith('LB') && r !== 'GF'
  const isLB   = (r:string) =>  r.startsWith('LB')
  const wbRounds = rounds
    .filter(isWB)
    .sort((a, b) => roundOrder(a) - roundOrder(b))
  const lbRounds = rounds.filter(isLB)
  const hasGF    = rounds.includes('GF')
  const rrRows   = config?.knockoutFormat === 'ROUND_ROBIN' ? roundRobinStandings(matches) : []
  const knockoutStandings = buildKnockoutStandings(
    qualified.map(q => ({
      id: q.team.id,
      name: q.team.team?.name ?? '',
      club: q.team.team?.club ?? null,
      seed: q.seed,
    })),
    matches,
    config?.knockoutFormat,
  )

  function renderRoundCol(round: string) {
    const roundMs = matches
      .filter(m => m.round === round)
      .sort((a: any, b: any) => ((a.matchOrder ?? 9999) - (b.matchOrder ?? 9999)) || ((a.matchNumber ?? 0) - (b.matchNumber ?? 0)))
    return (
      <div key={round} className="w-44 shrink-0">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">
          {roundLabel(round)}
        </div>
        <div className="space-y-3">
          {roundMs.map((m:any) => {
            // Laimėtoją nustatyti iš winnerId (tiksliausias), homeSets arba setų skaičiaus
            const hSetsWon = (m.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length
            const aSetsWon = (m.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length
            const hW = m.status==='FINISHED' && (
              m.winnerId ? m.winnerId === m.homeTeamId
              : m.homeSets != null ? m.homeSets > m.awaySets
              : hSetsWon > aSetsWon
            )
            const aW = m.status==='FINISHED' && (
              m.winnerId ? m.winnerId === m.awayTeamId
              : m.awaySets != null ? m.awaySets > m.homeSets
              : aSetsWon > hSetsWon
            )
            const hName = m.homeTeam?.team?.name
            const aName = m.awayTeam?.team?.name
            // Seed numeris iš DB (tournamentTeam.seedRank)
            const hSeed = m.homeTeam?.seedRank ?? null
            const aSeed = m.awayTeam?.seedRank ?? null
            return (
              <div key={m.id} className={`bg-white border rounded-xl overflow-hidden ${m.status==='FINISHED'?'border-green-300':m.status==='IN_PROGRESS'?'border-red-300':'border-gray-200'}`}>
                {[
                  {name:hName, seed:hSeed, sets:(m.sets??[]).filter((s:any)=>s.homeScore>s.awayScore).length || m.homeSets, win:hW},
                  {name:aName, seed:aSeed, sets:(m.sets??[]).filter((s:any)=>s.awayScore>s.homeScore).length || m.awaySets, win:aW},
                ].map((side,i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 text-xs ${side.win?'bg-green-50 font-semibold text-green-800':'text-gray-600'} ${i===1?'border-t border-gray-100':''}`}>
                    {side.seed && <span className="text-gray-400 font-normal w-5 text-right shrink-0">{side.seed}</span>}
                    <span className="flex-1 truncate">{side.name ?? <span className="italic text-gray-300">TBD</span>}</span>
                    {m.status==='FINISHED' && <span className={`font-bold text-sm shrink-0 ${side.win?'text-green-700':'text-gray-300'}`}>{side.sets}</span>}
                  </div>
                ))}
                {(m.court || m.scheduledAt || (m as any).matchOrder) && (
                  <div className="px-3 py-1 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                    <span>{m.court ? `A.${m.court}` : '—'}</span>
                    <div className="flex items-center gap-2">
                      {(m as any).matchOrder && (
                        <span className="text-gray-300 font-medium">#{(m as any).matchOrder}</span>
                      )}
                      <span>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('lt-LT',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Atkrintamosios</h1>
        <div className="flex gap-2">
          {matches.length > 0 && (
            <button onClick={clearKO} disabled={loading}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
              🗑 Išvalyti KO
            </button>
          )}
          <button onClick={generate} disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Generuojama...' : matches.length>0 ? 'Pergeneruoti braket' : 'Generuoti braket'}
          </button>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">{msg}</div>}

      {bracketOutOfSync && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800 border border-amber-200">
          Schema neatitinka dabartinio „Patenka į atkrintamąsias“ sąrašo. Pergeneruok bracketą, kad kortelėse būtų dabartinės komandos.
        </div>
      )}

      {/* ── Kvalifikuotų komandų sąrašas ── */}
      {qualified.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              Patenka į atkrintamąsias
              {!hasGroupResults && <span className="ml-2 text-xs font-normal text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Grupių rezultatai neįvesti — pagal registracijos eilę</span>}
            </span>
            <span className="text-xs text-gray-400">{qualified.length} komandų</span>
          </div>
          <div className="divide-y divide-gray-50">
            {/* Lentelės antraštė */}
          {hasGroupResults && (
            <div className="flex items-center gap-3 px-3 pb-1 border-b border-gray-100 mb-1">
              <div className="w-7 shrink-0"/>
              <div className="flex-1 min-w-0"/>
              <div className="text-xs font-medium text-gray-400 shrink-0 w-32 text-right">Grupė · Vieta</div>
              <div className="text-xs font-medium text-gray-400 shrink-0 grid grid-cols-5 gap-3 w-72 text-center">
                <span title="Taškai (1 už laimėjimą pagal TWO_ONE)">Taškai</span>
                <span title="Laimėjimai / Pralaimėjimai">L/P</span>
                <span title="Setų santykis: laimėti/prarasti">S.sant.</span>
                <span title="Taškų santykis: laimėti/prarasti">T.sant.</span>
                <span title="Taškų skirtumas: laimėti − prarasti">T.skirt.</span>
              </div>
            </div>
          )}
          {qualified.map((q, i) => {
              const isWild = config?.knockoutFormat === 'LUCKY_LOSER'
                ? i >= luckyLoserDirectPositions * sortedGroups.length
                : advMode==='total' && i >= advPerGroup * sortedGroups.length
              return (
                <div key={q.team.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${i===0?'bg-yellow-400 text-white':i===1?'bg-gray-300 text-white':i===2?'bg-orange-300 text-white':'bg-gray-100 text-gray-600'}`}>
                    {q.seed}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 text-sm">{q.team.team?.name}</span>
                    {q.team.team?.club && <span className="text-xs text-gray-400 ml-2">{q.team.team.club}</span>}
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                    Gr.{q.group} · {q.pos} vieta
                  </span>

                  {isWild && (
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full shrink-0 font-medium">wild card</span>
                  )}
                  <div className="text-xs text-gray-400 text-right shrink-0 grid grid-cols-5 gap-3 w-72">
                    {(() => {
                      const t = q.team
                      const setR   = t.groupSetsLost  > 0 ? (t.groupSetsWon  / t.groupSetsLost ).toFixed(2) : t.groupSetsWon  > 0 ? '∞' : '—'
                      const ptR    = t.groupPtsLost   > 0 ? (t.groupPtsWon   / t.groupPtsLost  ).toFixed(2) : t.groupPtsWon   > 0 ? '∞' : '—'
                      const ptDiff = t.groupPtsWon - t.groupPtsLost
                      const setRStr = t.groupSetsLost > 0 ? `${setR} (${t.groupSetsWon}/${t.groupSetsLost})` : setR
                      const ptRStr  = t.groupPtsLost  > 0 ? `${ptR} (${t.groupPtsWon}/${t.groupPtsLost})`   : ptR
                      return (<>
                        <span className="text-center">{t.groupPoints}t.</span>
                        <span className="text-center">{t.groupWins}L/{t.groupLosses}P</span>
                        <span className="text-center">{setRStr}</span>
                        <span className="text-center">{ptRStr}</span>
                        <span className={`text-center font-medium ${ptDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {ptDiff >= 0 ? '+' : ''}{ptDiff}
                        </span>
                      </>)
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {qualified.length === 0 && matches.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400 mb-5">
          <p className="text-lg mb-2">🏆</p>
          <p>Grupių rezultatai neįvesti arba grupės nesuformuotos.</p>
          <p className="text-sm mt-1 text-gray-400">Įvedus grupių rezultatus čia automatiškai atsiras kvalifikuotų komandų sąrašas.</p>
        </div>
      )}

      {/* ── Braket ── */}
      {matches.length > 0 && (
        <>
          {config?.knockoutFormat === 'DOUBLE_ELIMINATION'
            ? (
              <>
                <ExampleDEBracket matches={matches} />
                <DEBracket matches={matches} />
              </>
            )
            : (
              <>
                {config?.knockoutFormat === 'ROUND_ROBIN' && rrRows.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Apskritosios lentelė</span>
                      <span className="text-xs text-gray-400">visi su visais</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {rrRows.map((row, i) => {
                        const setR = row.setsLost > 0 ? (row.setsWon / row.setsLost).toFixed(2) : row.setsWon > 0 ? '∞' : '—'
                        const ptR = row.ptsLost > 0 ? (row.ptsWon / row.ptsLost).toFixed(2) : row.ptsWon > 0 ? '∞' : '—'
                        const diff = row.ptsWon - row.ptsLost
                        return (
                          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i===0?'bg-yellow-400 text-white':i===1?'bg-gray-300 text-white':i===2?'bg-orange-300 text-white':'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-900">{row.name}</span>
                              {row.seed && <span className="text-xs text-gray-400 ml-2">#{row.seed}</span>}
                            </div>
                            <div className="text-xs text-gray-500 grid grid-cols-5 gap-3 w-72 text-center shrink-0">
                              <span>{row.played} ž.</span>
                              <span>{row.wins}L/{row.losses}P</span>
                              <span>{setR} ({row.setsWon}/{row.setsLost})</span>
                              <span>{ptR}</span>
                              <span className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{diff >= 0 ? '+' : ''}{diff}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {wbRounds.length > 0 && (
                  <div className="mb-4">
                    <div className="overflow-x-auto">
                      <div className="flex gap-3 min-w-max pb-2">
                        {wbRounds.map(r => renderRoundCol(r))}
                      </div>
                    </div>
                  </div>
                )}
                {hasGF && <div className="mb-4">{renderRoundCol('GF')}</div>}
              </>
            )
          }
        </>
      )}

      {matches.length === 0 && qualified.length > 0 && (
        <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-gray-400">
          <p className="text-sm">Braket dar negeneruotas. Spausk „Generuoti braket".</p>
        </div>
      )}

      {qualified.length > 0 && <KnockoutResultsTable result={knockoutStandings} />}
    </div>
  )
}
