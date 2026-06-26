// ============================================================
// src/lib/bracket.ts
// FIVB paplūdimio tinklinio braket sistemos:
//   SINGLE_ELIMINATION — standartinis vieno pralaimėjimo
//   LUCKY_LOSER        — FIVB oficiali: LL raundas + single elim
//   DOUBLE_ELIMINATION — klasikinis dviejų pralaimėjimų
//   ROUND_ROBIN        — viena finalinė grupė, visi su visais
// ============================================================

import { prisma } from './prisma'
import { groupAdvanceCounts } from './tournament/qualification'
import { groupMatchPoints } from './tournament/points'

export type BracketTeam = {
  tournamentTeamId: string
  name:             string
  seed:             number | null
  fromGroup:        string | null
  fromPosition:     number | null
}

// ─── Bangų seka (priskyrimas matchOrder) ─────────────────────
const MATCH_WAVE_16: Record<string, number> = {
  LL:      0,
  R64:     1, R32:    1, R16:    1,   // banga 1
  QF:      2,                          // banga 2
  'LB-R1': 3,                          // banga 3
  'LB-R2': 4,                          // banga 4
  SF:      5,                          // banga 5
  'LB-R3': 6,                          // banga 6
  'LB-R4': 7, 'LB-SF': 7,            // banga 7 (pusfinaliai)
  F:       8,  'LB-F': 8,            // banga 8
  '3rd':   9,                          // banga 9
  GF:      10,                         // banga 10
}

const MATCH_WAVE_8: Record<string, number> = {
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

function matchWave(round: string | null, hasR16: boolean) {
  if (round?.startsWith('RR')) {
    const n = Number(round.slice(2))
    return Number.isFinite(n) && n > 0 ? n : 99
  }
  const waveMap = hasR16 ? MATCH_WAVE_16 : MATCH_WAVE_8
  return waveMap[round ?? ''] ?? 99
}

// ─── Pagrindinė funkcija ──────────────────────────────────────

export async function generateBracket(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where:   { id: tournamentId },
    include: {
      config: true,
      groups: {
        include: {
          teams: {
            include: { team: true },
          },
          matches: {
            where: { status: 'FINISHED' },
            include: { sets: true },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!tournament?.config) throw new Error('Nėra konfigūracijos')

  const cfg    = tournament.config
  const format = cfg.knockoutFormat

  // Apskaičiuoti kiek komandų patenka tiesiogiai iš kiekvienos grupės.
  // advanceMode='total' reiškia: advancePerGroup tiesiogiai + geriausi wild card iki advanceTotal.
  const groups = tournament.groups
  const advanceCounts = groupAdvanceCounts(cfg, groups.length, groups.map(g => g.maxTeams))
  const groupsWithCount = groups.map((g, index) => ({
    ...g,
    advanceCount: advanceCounts[index] ?? g.advanceCount ?? cfg.advancePerGroup ?? 2,
  }))

  // Ištrinti senus KO mačus
  await prisma.match.deleteMany({ where: { tournamentId, groupId: null } })
  await prisma.tournamentTeam.updateMany({
    where: { tournamentId },
    data: { seedRank: null },
  })

  if (format === 'LUCKY_LOSER') {
    await createLuckyLoserBracket(tournamentId, groupsWithCount, cfg)
  } else if (format === 'DOUBLE_ELIMINATION') {
    const qualified = getQualifiedTeams(
      groupsWithCount,
      cfg.advanceMode === 'total' ? cfg.advanceTotal ?? undefined : undefined,
      cfg.groupPointSystem,
    )
    if (qualified.length > 16) {
      throw new Error('Dviejų minusų sistema palaiko iki 16 komandų')
    }
    const size      = qualified.length <= 8 ? 8 : 16
    await saveSeedRanks(qualified)
    await createDoubleElimBracket(tournamentId, qualified, size, cfg)
  } else if (format === 'ROUND_ROBIN') {
    const qualified = getQualifiedTeams(
      groupsWithCount,
      cfg.advanceMode === 'total' ? cfg.advanceTotal ?? undefined : undefined,
      cfg.groupPointSystem,
    )
    await saveSeedRanks(qualified)
    await createRoundRobinBracket(tournamentId, qualified)
  } else {
    const qualified = getQualifiedTeams(
      groupsWithCount,
      cfg.advanceMode === 'total' ? cfg.advanceTotal ?? undefined : undefined,
      cfg.groupPointSystem,
    )
    const size      = nextPowerOf2(qualified.length)
    await saveSeedRanks(qualified)
    await createSingleElimBracket(tournamentId, qualified, size, cfg)
  }

  // Priskirti globalų eilės numerį kiekvienam mačui
  await assignMatchOrder(tournamentId)
}

async function saveSeedRanks(teams: BracketTeam[]) {
  for (const t of teams) {
    if (t.seed !== null) {
      await prisma.tournamentTeam.update({
        where: { id: t.tournamentTeamId },
        data:  { seedRank: t.seed },
      })
    }
  }
}

export async function assignMatchOrder(tournamentId: string) {
  const matches = await prisma.match.findMany({
    where:   { tournamentId, groupId: null },
  })
  const hasR16 = matches.some(m => m.round === 'R16')
  const sorted = [...matches].sort((a, b) => {
    const aw = matchWave(a.round, hasR16)
    const bw = matchWave(b.round, hasR16)
    if (aw !== bw) return aw - bw
    return (a.matchNumber ?? 0) - (b.matchNumber ?? 0)
  })
  for (let i = 0; i < sorted.length; i++) {
    await prisma.match.update({
      where: { id: sorted[i].id },
      data:  { matchOrder: i + 1 },
    })
  }
}

// ─── Komandų surinkimas ir rikiavimas ─────────────────────────

function safeRatio(a: number, b: number): number {
  return b > 0 ? a / b : (a > 0 ? Infinity : 0)
}

function headToHeadOrder(a: any, b: any, teams: any[], matches: any[] = []) {
  const aPts = Number(a.groupPoints ?? 0)
  const bPts = Number(b.groupPoints ?? 0)
  const samePoints = teams.filter(t => Number(t.groupPoints ?? 0) === aPts)
  if (aPts !== bPts || samePoints.length !== 2) return 0

  const match = matches.find((m: any) =>
    m.status === 'FINISHED' &&
    ((m.homeTeamId === a.id && m.awayTeamId === b.id) ||
     (m.homeTeamId === b.id && m.awayTeamId === a.id))
  )
  if (!match?.winnerId) return 0
  if (match.winnerId === a.id) return -1
  if (match.winnerId === b.id) return 1
  return 0
}

function sortGroupTeams(teams: any[], matches: any[] = []): any[] {
  return [...teams].sort((a, b) => {
    const aPts = Number(a.groupPoints ?? 0), bPts = Number(b.groupPoints ?? 0)
    const aW   = Number(a.groupWins   ?? 0), bW   = Number(b.groupWins   ?? 0)
    if (bPts !== aPts) return bPts - aPts
    const h2h = headToHeadOrder(a, b, teams, matches)
    if (h2h !== 0) return h2h
    if (bW   !== aW)   return bW   - aW
    const asr = safeRatio(Number(a.groupSetsWon ?? 0), Number(a.groupSetsLost ?? 0))
    const bsr = safeRatio(Number(b.groupSetsWon ?? 0), Number(b.groupSetsLost ?? 0))
    if (Math.abs(bsr - asr) > 0.001) return bsr - asr
    const apr = safeRatio(Number(a.groupPtsWon ?? 0), Number(a.groupPtsLost ?? 0))
    const bpr = safeRatio(Number(b.groupPtsWon ?? 0), Number(b.groupPtsLost ?? 0))
    if (Math.abs(bpr - apr) > 0.001) return bpr - apr
    return (Number(b.groupPtsWon ?? 0) - Number(b.groupPtsLost ?? 0)) -
      (Number(a.groupPtsWon ?? 0) - Number(a.groupPtsLost ?? 0))
  })
}

function sortTeamsByStats(teams: BracketTeam[], groups: any[], pointSystem = 'TWO_ONE'): BracketTeam[] {
  return [...teams].sort((a, b) => {
    const ta = groups.find((g: any) => g.name === a.fromGroup)
      ?.teams[(a.fromPosition ?? 1) - 1]
    const tb = groups.find((g: any) => g.name === b.fromGroup)
      ?.teams[(b.fromPosition ?? 1) - 1]
    if (!ta || !tb) return 0
    const taPts = Number(ta.groupPoints ?? 0), tbPts = Number(tb.groupPoints ?? 0)
    const taW   = Number(ta.groupWins   ?? 0), tbW   = Number(tb.groupWins   ?? 0)
    const asr = safeRatio(Number(ta.groupSetsWon ?? 0), Number(ta.groupSetsLost ?? 0))
    const bsr = safeRatio(Number(tb.groupSetsWon ?? 0), Number(tb.groupSetsLost ?? 0))
    const apr = safeRatio(Number(ta.groupPtsWon ?? 0), Number(ta.groupPtsLost ?? 0))
    const bpr = safeRatio(Number(tb.groupPtsWon ?? 0), Number(tb.groupPtsLost ?? 0))

    if (pointSystem === 'SET_RATIO') {
      if (Math.abs(bsr - asr) > 0.001) return bsr - asr
      if (Math.abs(bpr - apr) > 0.001) return bpr - apr
      const aDiff = Number(ta.groupPtsWon ?? 0) - Number(ta.groupPtsLost ?? 0)
      const bDiff = Number(tb.groupPtsWon ?? 0) - Number(tb.groupPtsLost ?? 0)
      if (bDiff !== aDiff) return bDiff - aDiff
      return (a.fromGroup ?? '').localeCompare(b.fromGroup ?? '')
    }

    if (tbPts !== taPts) return tbPts - taPts
    if (tbW   !== taW)   return tbW   - taW
    if (Math.abs(bsr - asr) > 0.001) return bsr - asr
    if (Math.abs(bpr - apr) > 0.001) return bpr - apr
    return (a.fromGroup ?? '').localeCompare(b.fromGroup ?? '')
  })
}

function calcAdjustedStats(tt: any, group: any, minGroupSize: number, pointSystem = 'TWO_ONE') {
  if ((group.teams?.length ?? 0) <= minGroupSize) {
    return {
      pts:  Number(tt.groupPoints ?? 0),
      setR: safeRatio(Number(tt.groupSetsWon ?? 0), Number(tt.groupSetsLost ?? 0)),
      ptR:  safeRatio(Number(tt.groupPtsWon ?? 0), Number(tt.groupPtsLost ?? 0)),
    }
  }

  const excludedTeamIds = new Set(
    (group.teams ?? []).slice(minGroupSize).map((team: any) => team.id)
  )
  let points = 0, setsWon = 0, setsLost = 0, ptsWon = 0, ptsLost = 0
  for (const match of group.matches ?? []) {
    if (match.status !== 'FINISHED') continue
    const isHome = match.homeTeamId === tt.id
    const isAway = match.awayTeamId === tt.id
    if (!isHome && !isAway) continue
    const opponentId = isHome ? match.awayTeamId : match.homeTeamId
    if (excludedTeamIds.has(opponentId)) continue

    const setRows = match.sets ?? []
    const homeSetsWon = setRows.filter((set: any) => set.homeScore > set.awayScore).length
    const awaySetsWon = setRows.filter((set: any) => set.awayScore > set.homeScore).length
    const winnerId = match.winnerId
    const homeWon = winnerId ? winnerId === match.homeTeamId : (match.homeSets ?? 0) > (match.awaySets ?? 0)

    if (isHome) {
      setsWon += homeSetsWon
      setsLost += awaySetsWon
      for (const set of setRows.filter((set: any) => !set.isTiebreak)) {
        ptsWon += set.homeScore
        ptsLost += set.awayScore
      }
      points += groupMatchPoints(pointSystem, homeSetsWon, awaySetsWon, homeWon)
    } else {
      setsWon += awaySetsWon
      setsLost += homeSetsWon
      for (const set of setRows.filter((set: any) => !set.isTiebreak)) {
        ptsWon += set.awayScore
        ptsLost += set.homeScore
      }
      points += groupMatchPoints(pointSystem, awaySetsWon, homeSetsWon, !homeWon)
    }
  }

  return {
    pts: points,
    setR: safeRatio(setsWon, setsLost),
    ptR: safeRatio(ptsWon, ptsLost),
  }
}

export function getQualifiedTeams(groups: any[], totalLimit?: number, pointSystem = 'TWO_ONE'): BracketTeam[] {
  const qualified: BracketTeam[] = []
  const sortedGroups = groups
    .map((group: any) => ({ ...group, teams: sortGroupTeams(group.teams ?? [], group.matches ?? []) }))
    .sort((a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''))
  const maxAdv = Math.max(...sortedGroups.map((g: any) => g.advanceCount ?? 0))

  for (let pos = 0; pos < maxAdv; pos++) {
    // Surinkti visas komandas šioje pozicijoje
    const samePos: BracketTeam[] = []
    for (const g of sortedGroups) {
      if (pos < (g.advanceCount ?? 0) && g.teams[pos]) {
        const tt = g.teams[pos]
        samePos.push({
          tournamentTeamId: tt.id,
          name:             tt.team.name,
          seed:             null,
          fromGroup:        g.name,
          fromPosition:     pos + 1,
        })
      }
    }
    // Rikiuoti vienodų pozicijų komandas pagal FIVB statistiką
    const sorted = sortTeamsByStats(samePos, sortedGroups, pointSystem)
    for (const t of sorted) {
      t.seed = qualified.length + 1
      qualified.push(t)
    }
  }

  if (totalLimit !== undefined) {
    if (qualified.length > totalLimit) {
      qualified.length = totalLimit
    } else if (qualified.length < totalLimit) {
      const nextPos = maxAdv
      const minGroupSize = Math.min(...sortedGroups.map((g: any) => g.teams.length))
      const wildcards: (BracketTeam & { adjustedPts: number; adjustedSetR: number; adjustedPtR: number })[] = []
      const already = new Set(qualified.map(t => t.tournamentTeamId))
      for (const g of sortedGroups) {
        const tt = g.teams[nextPos]
        if (!tt || already.has(tt.id)) continue
        const adjusted = calcAdjustedStats(tt, g, minGroupSize, pointSystem)
        wildcards.push({
          tournamentTeamId: tt.id,
          name:             tt.team.name,
          seed:             null,
          fromGroup:        g.name,
          fromPosition:     nextPos + 1,
          adjustedPts:      adjusted.pts,
          adjustedSetR:     adjusted.setR,
          adjustedPtR:      adjusted.ptR,
        })
      }
      const sortedWildcards = [...wildcards].sort((a, b) => {
        if (pointSystem === 'SET_RATIO') {
          if (Math.abs(b.adjustedSetR - a.adjustedSetR) > 0.001) return b.adjustedSetR - a.adjustedSetR
          if (Math.abs(b.adjustedPtR - a.adjustedPtR) > 0.001) return b.adjustedPtR - a.adjustedPtR
          return (a.fromGroup ?? '').localeCompare(b.fromGroup ?? '')
        }
        if (b.adjustedPts !== a.adjustedPts) return b.adjustedPts - a.adjustedPts
        if (Math.abs(b.adjustedSetR - a.adjustedSetR) > 0.001) return b.adjustedSetR - a.adjustedSetR
        if (Math.abs(b.adjustedPtR - a.adjustedPtR) > 0.001) return b.adjustedPtR - a.adjustedPtR
        return (a.fromGroup ?? '').localeCompare(b.fromGroup ?? '')
      })
      for (const t of sortedWildcards) {
        if (qualified.length >= totalLimit) break
        qualified.push(t)
      }
    }
  }

  qualified.forEach((t, i) => { t.seed = i + 1 })
  return qualified
}

// ─── Round Robin / Apskritasis ────────────────────────────────

async function createRoundRobinBracket(
  tournamentId: string,
  teams: BracketTeam[],
) {
  if (teams.length < 2) return

  const slots: (BracketTeam | null)[] = [...teams]
  if (slots.length % 2 === 1) slots.push(null)

  const rounds = slots.length - 1
  const matchesPerRound = slots.length / 2
  let rotation = [...slots]
  let matchNumber = 1

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const a = rotation[i]
      const b = rotation[rotation.length - 1 - i]
      if (!a || !b) continue

      const flipHome = (r + i) % 2 === 1
      const home = flipHome ? b : a
      const away = flipHome ? a : b

      await prisma.match.create({
        data: {
          tournamentId,
          round:       `RR${r + 1}`,
          matchNumber: matchNumber++,
          homeTeamId:  home.tournamentTeamId,
          awayTeamId:  away.tournamentTeamId,
          status:      'SCHEDULED',
        },
      })
    }

    rotation = [
      rotation[0],
      rotation[rotation.length - 1],
      ...rotation.slice(1, rotation.length - 1),
    ]
  }
}

// ─── LUCKY LOSER ─────────────────────────────────────────────

export function buildLuckyLoserPlan(groups: any[], cfg: any = {}) {
  const sortedGroups = groups.map((g: any) => ({ ...g, teams: sortGroupTeams(g.teams ?? [], g.matches ?? []) }))

  const byPos: Record<number, BracketTeam[]> = {}
  for (const g of sortedGroups) {
    g.teams.forEach((tt: any, i: number) => {
      const pos = i + 1
      if (!byPos[pos]) byPos[pos] = []
      byPos[pos].push({
        tournamentTeamId: tt.id,
        name:             tt.team.name,
        seed:             null,
        fromGroup:        g.name,
        fromPosition:     pos,
      })
    })
  }

  const directPositions = Math.max(1, Number(cfg.advancePerGroup ?? 2))
  const direct: BracketTeam[] = []
  for (let pos = 1; pos <= directPositions; pos++) {
    direct.push(...sortTeamsByStats(byPos[pos] ?? [], sortedGroups, cfg.groupPointSystem))
  }

  const totalTarget = cfg.advanceMode === 'total'
    ? Math.max(direct.length, Number(cfg.advanceTotal ?? direct.length))
    : direct.length + (byPos[directPositions + 1]?.length ?? 0)

  const llSorted: BracketTeam[] = []
  for (let pos = directPositions + 1; llSorted.length < totalTarget - direct.length; pos++) {
    const samePos = byPos[pos] ?? []
    if (samePos.length === 0) break
    for (const team of sortTeamsByStats(samePos, sortedGroups, cfg.groupPointSystem)) {
      if (llSorted.length >= totalTarget - direct.length) break
      llSorted.push(team)
    }
  }

  direct.forEach((t, i) => { t.seed = i + 1 })
  llSorted.forEach((t, i) => { t.seed = direct.length + i + 1 })

  const llMatches:   { home: BracketTeam | null; away: BracketTeam | null }[] = []
  const llBypassers: BracketTeam[] = []

  if (llSorted.length === 1) {
    llBypassers.push(llSorted[0])
  } else if (llSorted.length === 2) {
    llMatches.push({ home: llSorted[0], away: llSorted[1] })
  } else if (llSorted.length === 3) {
    llBypassers.push(llSorted[0])
    llMatches.push({ home: llSorted[1], away: llSorted[2] })
  } else if (llSorted.length > 3) {
    for (let i = 0; i < llSorted.length - 1; i += 2) {
      llMatches.push({ home: llSorted[i], away: llSorted[i + 1] })
    }
    if (llSorted.length % 2 === 1) llBypassers.push(llSorted[llSorted.length - 1])
  }

  const allMain: (BracketTeam | null)[] = [
    ...direct,
    ...llBypassers,
    ...llMatches.map(() => null),
  ]
  const size = Math.max(2, nextPowerOf2(allMain.length))
  const rounds = Math.log2(size)
  const roundNames = getRoundNames(rounds)
  const firstRound = roundNames[0]
  const pairs = buildSeedPairs(size)
  const placeholderSeeds = new Map<number, number>()

  for (let i = 0; i < llMatches.length; i++) {
    placeholderSeeds.set(i + 1, direct.length + llBypassers.length + i + 1)
  }

  const llDestinations = new Map<number, { round: string; matchNumber: number; slot: 'homeTeamId' | 'awayTeamId' }>()
  for (const [llMatchNumber, seed] of placeholderSeeds.entries()) {
    for (let qi = 0; qi < pairs.length; qi++) {
      const [s1, s2] = pairs[qi]
      if (s1 === seed || s2 === seed) {
        llDestinations.set(llMatchNumber, {
          round: firstRound,
          matchNumber: qi + 1,
          slot: s1 === seed ? 'homeTeamId' : 'awayTeamId',
        })
        break
      }
    }
  }

  return {
    direct,
    llSorted,
    llMatches,
    llBypassers,
    allMain,
    size,
    rounds,
    roundNames,
    firstRound,
    pairs,
    placeholderSeeds,
    llDestinations,
  }
}

async function createLuckyLoserBracket(
  tournamentId: string,
  groups:       any[],
  cfg:          any,
) {
  const plan = buildLuckyLoserPlan(groups, cfg)

  await saveSeedRanks([...plan.direct, ...plan.llSorted])

  // Sukurti LL mačus
  const llMatchIds: string[] = []
  for (let i = 0; i < plan.llMatches.length; i++) {
    const { home, away } = plan.llMatches[i]
    const m = await prisma.match.create({
      data: {
        tournamentId,
        round:       'LL',
        matchNumber: i + 1,
        homeTeamId:  home?.tournamentTeamId ?? null,
        awayTeamId:  away?.tournamentTeamId ?? null,
        status:      'SCHEDULED',
      },
    })
    llMatchIds.push(m.id)
  }

  const firstRoundIds: string[] = []
  for (let i = 0; i < plan.pairs.length; i++) {
    const [s1, s2] = plan.pairs[i]
    const home = plan.allMain[s1 - 1] ?? null
    const away = plan.allMain[s2 - 1] ?? null
    const homeIsLlWinner = [...plan.placeholderSeeds.values()].includes(s1)
    const awayIsLlWinner = [...plan.placeholderSeeds.values()].includes(s2)
    const homeId = home?.tournamentTeamId ?? null
    const awayId = away?.tournamentTeamId ?? null
    const bye = !homeIsLlWinner && !awayIsLlWinner && Boolean(homeId || awayId) && (!homeId || !awayId)
    const winnerId = bye ? (homeId ?? awayId) : null

    const m = await prisma.match.create({
      data: {
        tournamentId,
        round:       plan.firstRound,
        matchNumber: i + 1,
        homeTeamId:  homeId,
        awayTeamId:  awayId,
        status:      bye ? 'FINISHED' : 'SCHEDULED',
        homeSets:    bye && homeId ? 2 : bye ? 0 : null,
        awaySets:    bye && awayId ? 2 : bye ? 0 : null,
        winnerId,
      },
    })
    firstRoundIds.push(m.id)
  }

  for (let r = 1; r < plan.rounds; r++) {
    const count = plan.size / Math.pow(2, r + 1)
    for (let i = 0; i < count; i++) {
      await prisma.match.create({
        data: { tournamentId, round: plan.roundNames[r], matchNumber: i + 1, status: 'SCHEDULED' },
      })
    }
  }

  // Dėl 3 vietos ir Finalas
  if (cfg.thirdPlaceMatch !== false) {
    await prisma.match.create({
      data: { tournamentId, round: '3rd', matchNumber: 1, status: 'SCHEDULED' },
    })
  }
  // Advance bye komandas pagrindiniame medyje
  for (const id of firstRoundIds) {
    const m = await prisma.match.findUnique({ where: { id } })
    if (m?.status === 'FINISHED' && m.winnerId) await advanceWinner(id)
  }

  // Jei LL mačai jau baigti po regeneravimo ar korekcijos - perkelti jų laimėtojus
  for (const id of llMatchIds) {
    const m = await prisma.match.findUnique({ where: { id } })
    if (m?.status === 'FINISHED' && m.winnerId) await advanceWinner(id)
  }
}

// ─── Single Elimination ───────────────────────────────────────

async function createSingleElimBracket(
  tournamentId: string,
  teams:        BracketTeam[],
  size:         number,
  cfg:          any,
) {
  const rounds     = Math.log2(size)
  const roundNames = getRoundNames(rounds)
  const pairs      = buildMatchPairs(teams, size)
  const firstRoundIds: string[] = []

  for (let i = 0; i < pairs.length; i++) {
    const [home, away] = pairs[i]
    const bye    = !home || !away
    const winner = bye ? (home ?? away) : null

    const m = await prisma.match.create({
      data: {
        tournamentId,
        round:       roundNames[0],
        matchNumber: i + 1,
        homeTeamId:  home?.tournamentTeamId ?? null,
        awayTeamId:  away?.tournamentTeamId ?? null,
        status:      bye ? 'FINISHED' : 'SCHEDULED',
        homeSets:    bye && home ? 2 : null,
        awaySets:    bye && home ? 0 : null,
        winnerId:    winner?.tournamentTeamId ?? null,
      },
    })
    firstRoundIds.push(m.id)
  }

  for (let r = 1; r < rounds; r++) {
    const count = size / Math.pow(2, r + 1)
    for (let i = 0; i < count; i++) {
      await prisma.match.create({
        data: { tournamentId, round: roundNames[r], matchNumber: i + 1, status: 'SCHEDULED' },
      })
    }
  }

  if (cfg.thirdPlaceMatch !== false) {
    await prisma.match.create({
      data: { tournamentId, round: '3rd', matchNumber: 1, status: 'SCHEDULED' },
    })
  }

  for (const id of firstRoundIds) {
    const m = await prisma.match.findUnique({ where: { id } })
    if (m?.status === 'FINISHED' && m.winnerId) await advanceWinner(id)
  }
}

// ─── Double Elimination ───────────────────────────────────────
// DE lapelių schemos yra tik 2 tipų:
// iki 8 komandų → pilna 8 vietų schema
// 9-16 komandų → pilna 16 vietų schema
// Jei komandų mažiau nei vietų, lapeliai be realių rungtynių lieka DB/schemai,
// bet tvarkaraštyje ir rezultatuose filtruojami kaip techniniai perėjimai.
//
// 16 komandų DE struktūra (size=16):
// WB:    R16(8) → QF(4) → SF(2) → F(1)
// LB:    LB-R1(4) → LB-R2(4) → LB-R3(2) → LB-R4(2) → LB-SF(1) → LB-F(1) → GF(1)
// Iš viso: 30 rungtynės

async function createDoubleElimBracket(
  tournamentId: string,
  teams:        BracketTeam[],
  size:         number,
  cfg:          any,
) {
  // WB raundų skaičius pagal bracket dydį.
  // 12 komandų naudoja 16 vietų medį su R16 bye, todėl turi ir WB finalą (F).
  // 16 komandų → 4 (R16, QF, SF, F)
  const wbRoundsTotal  = Math.log2(size)
  const wbRoundsReal   = wbRoundsTotal
  const allRoundNames  = getRoundNames(wbRoundsTotal)   // ['R16','QF','SF','F']
  const roundNames     = allRoundNames.slice(0, wbRoundsReal)
  const pairs          = buildMatchPairs(teams, size)
  const firstRoundIds: string[] = []
  const hasWBFinal     = true

  // ─── Winners Bracket ────────────────────────────────────────

  // WB-R1
  for (let i = 0; i < pairs.length; i++) {
    const [home, away] = pairs[i]
    const bye    = !home || !away
    const winner = bye ? (home ?? away) : null
    const m = await prisma.match.create({
      data: {
        tournamentId,
        round:      roundNames[0],
        matchNumber: i + 1,
        homeTeamId:  home?.tournamentTeamId ?? null,
        awayTeamId:  away?.tournamentTeamId ?? null,
        status:      bye ? 'FINISHED' : 'SCHEDULED',
        homeSets:    bye && home ? 2 : null,
        awaySets:    bye && home ? 0 : null,
        winnerId:    winner?.tournamentTeamId ?? null,
      },
    })
    firstRoundIds.push(m.id)
  }

  // WB likę raundai
  for (let r = 1; r < wbRoundsReal; r++) {
    const count = size / Math.pow(2, r + 1)
    for (let i = 0; i < count; i++) {
      await prisma.match.create({
        data: { tournamentId, round: roundNames[r], matchNumber: i + 1, status: 'SCHEDULED' },
      })
    }
  }

  // ─── Losers Bracket ─────────────────────────────────────────
  const lbR1Count = size / 4

  // LB struktūra: drop(n) → join(2n) → play(n) → join(n) → play(n/2) → ...
  // Kai teams != 2^k: paskutinis play raundas yra pusfinaliai (2 mačai) — nėra LB-F
  // Kai teams = 2^k: paskutinis play = LB-SF (1 mačas), tada LB-F

  type LBRound = { name: string; count: number; type: string }
  const lbStructure: LBRound[] = []
  {
    let dropN = lbR1Count
    let lbR   = 1

    // Drop raundas
    lbStructure.push({ name: `LB-R${lbR}`, count: dropN, type: 'drop' })
    lbR++

    // Pakaitomis join ir play
    // join(2n) → play(n) → join(n) → play(n/2) → ...
    // Paskutinis etapas kai !hasWBFinal:
    //   paskutinis play raundas → LB-SF(JOIN, 2 mačai) kur WB-SF laimėtojai ateina
    //   WB-SF laimėtojai = WB paskutinio raundo laimėtojai
    let joinN = size / 4  // LB-R2 = QF pralaimėjusiųjų skaičius (visada size/4)
    while (joinN >= 1) {
      // Tikrinti ar kitas žingsnis būtų paskutinis join prieš finalus
      const nextPlayN = Math.floor(joinN / 2)
      const afterPlay = Math.floor(nextPlayN / 2)

      lbStructure.push({ name: `LB-R${lbR}`, count: joinN, type: 'join' })
      lbR++

      if (nextPlayN < 1) break

      if (!hasWBFinal && afterPlay < 1) {
        // Paskutinis play → LB pusfinalis/finalas iki GF.
        // 12 komandų atveju čia turi būti vienas realus mačas, ne du.
        const lbSFcount = nextPlayN
        lbStructure.push({ name: 'LB-SF', count: lbSFcount, type: 'join' })
        lbR++
        break
      } else {
        // Standartinis play
        const playName = (nextPlayN === 1 && hasWBFinal) ? 'LB-SF' : `LB-R${lbR}`
        lbStructure.push({ name: playName, count: nextPlayN, type: 'play' })
        lbR++
        if (nextPlayN === 1) break
      }
      joinN = nextPlayN
    }
  }

  for (const { name, count } of lbStructure) {
    for (let i = 0; i < count; i++) {
      await prisma.match.create({
        data: { tournamentId, round: name, matchNumber: i + 1, status: 'SCHEDULED' },
      })
    }
  }

  // LB-F tik kai 2^k komandų (standartinis DE)
  if (hasWBFinal) {
    await prisma.match.create({
      data: { tournamentId, round: 'LB-F', matchNumber: 1, status: 'SCHEDULED' },
    })
  }

  // Grand Finalas
  await prisma.match.create({
    data: { tournamentId, round: 'GF', matchNumber: 1, status: 'SCHEDULED' },
  })

  // Dėl 3 vietos
  if (cfg.thirdPlaceMatch !== false) {
    await prisma.match.create({
      data: { tournamentId, round: '3rd', matchNumber: 1, status: 'SCHEDULED' },
    })
  }

  // Advance bye komandas WB-R1
  for (const id of firstRoundIds) {
    const m = await prisma.match.findUnique({ where: { id } })
    if (m?.status === 'FINISHED' && m.winnerId) await advanceWinner(id)
  }
}

// ─── Pagalbinės funkcijos ─────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function getRoundNames(rounds: number): string[] {
  const names: Record<number, string> = {
    1: 'F', 2: 'SF', 3: 'QF', 4: 'R16', 5: 'R32', 6: 'R64',
  }
  const result: string[] = []
  for (let r = 0; r < rounds; r++) {
    result.push(names[rounds - r] ?? `R${rounds - r}`)
  }
  return result
}

// Standartinis turnyrinis braket'o seed susikirtimas
function buildSeedPairs(size: number): [number, number][] {
  if (size === 2) return [[1, 2]]
  const prev   = buildSeedPairs(size / 2)
  const result: [number, number][] = []
  for (const [a, b] of prev) {
    result.push([a,           size + 1 - a])
    result.push([size + 1 - b, b          ])
  }
  return result
}

function buildMatchPairs(teams: BracketTeam[], size: number): (BracketTeam | null)[][] {
  const n = teams.length
  return buildSeedPairs(size).map(([s1, s2]) => [
    s1 <= n ? teams[s1 - 1] : null,
    s2 <= n ? teams[s2 - 1] : null,
  ])
}

// ─── WB → LB pralaimėtojo perstūmimas ───────────────────────

// Kiekvienam WB raundui atitinkamas LB raundas kuriame atsiduria pralaimėjusieji.
// 8 komandų lapas prasideda nuo QF, todėl jo pirmo rato pralaimėtojai krenta į LB-R1.
const WB_TO_LB_16: Record<string, string> = {
  R64: 'LB-R1', R32: 'LB-R1', R16: 'LB-R1',  // WB-R1 pralaimėjusieji → LB-R1 (drop)
  QF:  'LB-R2',                                  // WB-R2 pralaimėjusieji → LB-R2 (join, away)
  SF:  'LB-R4',                                  // WB-R3 pralaimėjusieji → LB-R4 (join, away)
  F:   'LB-F',                                   // WB-F (16 kom.) pralaimėjusysis → LB-F
}

const WB_TO_LB_8: Record<string, string> = {
  QF: 'LB-R1',
  SF: 'LB-R2',
  F:  'LB-F',
}

async function getDoubleElimWbToLb(tournamentId: string) {
  const hasR16 = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'R16' },
    select: { id: true },
  })
  return hasR16 ? WB_TO_LB_16 : WB_TO_LB_8
}

async function hasR16Round(tournamentId: string) {
  return Boolean(await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'R16' },
    select: { id: true },
  }))
}

function swapPair(n: number) {
  return n % 2 === 1 ? n + 1 : n - 1
}

function getDoubleElimLoserDestination(round: string, matchNumber: number, hasR16: boolean) {
  const lbRound = (hasR16 ? WB_TO_LB_16 : WB_TO_LB_8)[round]
  if (!lbRound) return null

  if (lbRound === 'LB-R1') {
    return {
      round: lbRound,
      matchNumber: Math.ceil(matchNumber / 2),
      slot: matchNumber % 2 === 1 ? 'homeTeamId' as const : 'awayTeamId' as const,
    }
  }

  if (round === 'QF' && hasR16) {
    return { round: lbRound, matchNumber: swapPair(matchNumber), slot: 'awayTeamId' as const }
  }

  if (round === 'SF') {
    return { round: lbRound, matchNumber: swapPair(matchNumber), slot: 'awayTeamId' as const }
  }

  return { round: lbRound, matchNumber, slot: 'awayTeamId' as const }
}

export async function repairInitialLoserRound(tournamentId: string) {
  const hasR16 = await hasR16Round(tournamentId)
  const wbToLb = hasR16 ? WB_TO_LB_16 : WB_TO_LB_8
  const wbMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      groupId: null,
      round: { in: Object.keys(wbToLb) },
      status: 'FINISHED',
      winnerId: { not: null },
    },
    orderBy: [{ matchOrder: 'asc' }, { matchNumber: 'asc' }],
  })

  let moved = 0
  for (const m of wbMatches) {
    const loserId = m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId
    if (!loserId) continue

    const destination = getDoubleElimLoserDestination(m.round ?? '', m.matchNumber ?? 1, hasR16)
    if (!destination) continue

    const target = await prisma.match.findFirst({
      where: {
        tournamentId,
        groupId: null,
        round: destination.round,
        matchNumber: destination.matchNumber,
      },
    })
    if (!target) continue
    if (target.status === 'FINISHED') continue

    const slot = destination.slot
    const current = slot === 'homeTeamId' ? target.homeTeamId : target.awayTeamId
    if (current === loserId) continue

    const openLbMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        groupId: null,
        status: { not: 'FINISHED' },
        round: { startsWith: 'LB-' },
      },
    })
    for (const other of openLbMatches) {
      if (other.id === target.id) continue
      const data: { homeTeamId?: null; awayTeamId?: null } = {}
      if (other.homeTeamId === loserId) data.homeTeamId = null
      if (other.awayTeamId === loserId) data.awayTeamId = null
      if (Object.keys(data).length > 0) {
        await prisma.match.update({ where: { id: other.id }, data })
      }
    }

    await prisma.match.update({
      where: { id: target.id },
      data: { [slot]: loserId },
    })
    moved++
  }

  return moved
}

export async function ensureDoubleElimFinalRounds(tournamentId: string) {
  let moved = 0

  const sfCount = await prisma.match.count({
    where: { tournamentId, groupId: null, round: 'SF' },
  })
  const gf = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'GF' },
  })
  if (sfCount < 2 || !gf) return 0

  let final = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'F', matchNumber: 1 },
  })
  if (!final) {
    final = await prisma.match.create({
      data: { tournamentId, round: 'F', matchNumber: 1, status: 'SCHEDULED' },
    })
    moved++
  }

  let lbFinal = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'LB-F', matchNumber: 1 },
  })
  if (!lbFinal) {
    lbFinal = await prisma.match.create({
      data: { tournamentId, round: 'LB-F', matchNumber: 1, status: 'SCHEDULED' },
    })
    moved++
  }

  if (gf.status !== 'FINISHED' && (gf.homeTeamId || gf.awayTeamId) && (!final.winnerId || !lbFinal.winnerId)) {
    await prisma.match.update({
      where: { id: gf.id },
      data: { homeTeamId: null, awayTeamId: null },
    })
    moved++
  }

  const sfMatches = await prisma.match.findMany({
    where: { tournamentId, groupId: null, round: 'SF', status: 'FINISHED', winnerId: { not: null } },
    orderBy: { matchNumber: 'asc' },
  })
  const finalData: Record<string, string | null> = {}
  if (!final.homeTeamId && sfMatches[0]?.winnerId) finalData.homeTeamId = sfMatches[0].winnerId
  if (!final.awayTeamId && sfMatches[1]?.winnerId) finalData.awayTeamId = sfMatches[1].winnerId
  if (Object.keys(finalData).length > 0) {
    final = await prisma.match.update({ where: { id: final.id }, data: finalData })
    moved++
  }

  const lbSf = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'LB-SF', matchNumber: 1 },
  })
  if (lbSf?.winnerId && !lbFinal.homeTeamId) {
    lbFinal = await prisma.match.update({
      where: { id: lbFinal.id },
      data: { homeTeamId: lbSf.winnerId },
    })
    moved++
  }

  if (final.winnerId) {
    const gfNow = await prisma.match.findUnique({ where: { id: gf.id } })
    if (gfNow && !gfNow.homeTeamId) {
      await prisma.match.update({ where: { id: gf.id }, data: { homeTeamId: final.winnerId } })
      moved++
    }

    const loserId = final.winnerId === final.homeTeamId ? final.awayTeamId : final.homeTeamId
    if (loserId && !lbFinal.awayTeamId) {
      lbFinal = await prisma.match.update({
        where: { id: lbFinal.id },
        data: { awayTeamId: loserId },
      })
      moved++
    }
  }

  if (lbFinal.winnerId) {
    const gfNow = await prisma.match.findUnique({ where: { id: gf.id } })
    if (gfNow && !gfNow.awayTeamId) {
      await prisma.match.update({ where: { id: gf.id }, data: { awayTeamId: lbFinal.winnerId } })
      moved++
    }
  }

  moved += await syncDoubleElimThirdPlaceMatch(tournamentId)

  if (moved > 0) await assignMatchOrder(tournamentId)
  return moved
}

async function syncDoubleElimThirdPlaceMatch(tournamentId: string) {
  const thirdMatch = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: '3rd', matchNumber: 1 },
  })
  if (!thirdMatch) return 0

  const gf = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'GF', matchNumber: 1 },
  })
  const lbSf = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'LB-SF', matchNumber: 1 },
  })
  const lbFinal = await prisma.match.findFirst({
    where: { tournamentId, groupId: null, round: 'LB-F', matchNumber: 1 },
  })

  const gfTeams = new Set(
    [gf?.homeTeamId, gf?.awayTeamId].filter((teamId): teamId is string => Boolean(teamId))
  )
  const hasGrandFinalTeam =
    (thirdMatch.homeTeamId !== null && gfTeams.has(thirdMatch.homeTeamId)) ||
    (thirdMatch.awayTeamId !== null && gfTeams.has(thirdMatch.awayTeamId))
  if (thirdMatch.status === 'FINISHED' && !hasGrandFinalTeam) return 0

  const loserOf = (m: typeof lbSf | typeof lbFinal) => {
    if (!m?.winnerId) return null
    return m.winnerId === m.homeTeamId ? m.awayTeamId : m.homeTeamId
  }

  const candidates = [loserOf(lbSf), loserOf(lbFinal)]
    .filter((teamId): teamId is string => typeof teamId === 'string' && !gfTeams.has(teamId))

  const homeTeamId = candidates[0] ?? null
  const awayTeamId = candidates.find(teamId => teamId !== homeTeamId) ?? null

  if (thirdMatch.homeTeamId === homeTeamId && thirdMatch.awayTeamId === awayTeamId) return 0

  if (thirdMatch.status === 'FINISHED') {
    await prisma.set.deleteMany({ where: { matchId: thirdMatch.id } })
  }

  await prisma.match.update({
    where: { id: thirdMatch.id },
    data: {
      homeTeamId,
      awayTeamId,
      homeSets: null,
      awaySets: null,
      winnerId: null,
      status: 'SCHEDULED',
      startedAt: null,
      finishedAt: null,
    },
  })
  return 1
}

export async function advanceStructuralByes(tournamentId: string) {
  let moved = 0

  for (let i = 0; i < 20; i++) {
    const firstRoundName = await prisma.match.findFirst({
      where: { tournamentId, groupId: null, round: 'R16' },
    }) ? 'R16' : 'QF'
    const firstRound = await prisma.match.findMany({
      where: { tournamentId, groupId: null, round: firstRoundName },
      orderBy: { matchNumber: 'asc' },
    })
    const loserSourceCount = (matchNumber: number | null) =>
      [(matchNumber ?? 1) * 2 - 1, (matchNumber ?? 1) * 2].filter(n => {
        const source = firstRound.find(m => m.matchNumber === n)
        return source?.homeTeamId && source?.awayTeamId
      }).length

    const lbR1 = await prisma.match.findMany({
      where: { tournamentId, groupId: null, round: 'LB-R1' },
      orderBy: { matchNumber: 'asc' },
    })

    let progressed = false
    for (const match of lbR1) {
      if (match.status === 'FINISHED') continue
      if (loserSourceCount(match.matchNumber ?? null) >= 2) continue
      const winnerId = match.homeTeamId ?? match.awayTeamId
      if (!winnerId) continue

      await prisma.match.update({
        where: { id: match.id },
        data: {
          winnerId,
          status: 'FINISHED',
          homeSets: match.homeTeamId ? 2 : 0,
          awaySets: match.awayTeamId ? 2 : 0,
          finishedAt: new Date(),
        },
      })
      await advanceWinner(match.id)
      moved++
      progressed = true
    }

    const candidates = await prisma.match.findMany({
      where: {
        tournamentId,
        groupId: null,
        round: 'LB-R2',
        status: { not: 'FINISHED' },
        OR: [
          { homeTeamId: { not: null }, awayTeamId: null },
          { homeTeamId: null, awayTeamId: { not: null } },
        ],
      },
      orderBy: [{ matchNumber: 'asc' }],
    })

    const lbR2Progressed = await Promise.all(
      candidates.map(async match => {
        if (loserSourceCount(match.matchNumber ?? null) !== 0) return false
        const winnerId = match.homeTeamId ?? match.awayTeamId
        if (!winnerId) return false

        await prisma.match.update({
          where: { id: match.id },
          data: {
            winnerId,
            status: 'FINISHED',
            homeSets: match.homeTeamId ? 2 : 0,
            awaySets: match.awayTeamId ? 2 : 0,
            finishedAt: new Date(),
          },
        })
        await advanceWinner(match.id)
        moved++
        return true
      })
    )

    if (!progressed && !lbR2Progressed.some(Boolean)) break
  }

  return moved
}

export async function advanceLoser(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match?.winnerId || !match.round) return

  const loserId = match.winnerId === match.homeTeamId
    ? match.awayTeamId
    : match.homeTeamId
  if (!loserId) return

  const mn = match.matchNumber ?? 1
  const hasR16 = await hasR16Round(match.tournamentId)
  const destination = getDoubleElimLoserDestination(match.round, mn, hasR16)
  if (!destination) return

  const lbMatch = await prisma.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      round:        destination.round,
      matchNumber:  destination.matchNumber,
    },
  })
  if (!lbMatch) return

  await prisma.match.update({
    where: { id: lbMatch.id },
    data:  { [destination.slot]: loserId },
  })
}

async function advanceLuckyLoserWinner(match: {
  tournamentId: string
  matchNumber: number | null
  winnerId: string | null
}) {
  if (!match.winnerId) return

  const tournament = await prisma.tournament.findUnique({
    where: { id: match.tournamentId },
    include: {
      config: true,
      groups: {
        include: {
          teams: { include: { team: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
  if (!tournament) return

  const plan = buildLuckyLoserPlan(tournament.groups, tournament.config)
  const destination = plan.llDestinations.get(match.matchNumber ?? 1)
  if (!destination) return

  const target = await prisma.match.findFirst({
    where: {
      tournamentId: match.tournamentId,
      round: destination.round,
      matchNumber: destination.matchNumber,
    },
  })
  if (!target || target.status === 'FINISHED') return

  await prisma.match.update({
    where: { id: target.id },
    data: { [destination.slot]: match.winnerId },
  })
}

// ─── Laimėtojo perstūmimas ────────────────────────────────────

export async function advanceWinner(matchId: string) {
  const match = await prisma.match.findUnique({
    where:   { id: matchId },
    include: { tournament: { include: { config: true } } },
  })
  if (!match?.winnerId || !match.round) return

  const format = match.tournament.config?.knockoutFormat ?? 'SINGLE_ELIMINATION'

  if (format === 'LUCKY_LOSER' && match.round === 'LL') {
    await advanceLuckyLoserWinner(match)
    return
  }

  // Raundų seka pagal formatą
  // Raundų seka — atskirai WB ir LB
  const wbOrder = ['LL', 'R64', 'R32', 'R16', 'QF', 'SF', 'F', 'GF']
  const lbOrder = [
    'LB-R1', 'LB-R2', 'LB-R3', 'LB-R4', 'LB-R5', 'LB-R6', 'LB-SF', 'LB-F', 'GF'
  ]

  // Nustatyti ar tai WB ar LB mačas
  const isLB = lbOrder.includes(match.round ?? '')
  const order = isLB ? lbOrder : wbOrder

  const currentIdx = order.indexOf(match.round ?? '')
  if (currentIdx === -1) return

  // Rasti sekantį egzistuojantį raundą
  let nextRound: string | null = null
  for (let i = currentIdx + 1; i < order.length; i++) {
    const exists = await prisma.match.findFirst({
      where: { tournamentId: match.tournamentId, round: order[i] },
    })
    if (exists) { nextRound = order[i]; break }
  }
  if (!nextRound) return

  // WB: laimėtojas eina į ceil(mn/2) sekančio raundo poziciją
  // LB: laimėtojas eina tiesiai į tą patį matchNumber (mn→mn)
  // Nes LB-R1(4 mačai) → LB-R2(4 mačai): M1→M1, M2→M2, M3→M3, M4→M4
  // Bet LB-R3(2 mačai) → LB-R4(2 mačai): M1→M1, M2→M2 (taip pat tiesiai)
  // Tik kai LB raundų skaičius perpus mažėja: LB-R2(4)→LB-R3(2): M1,M2→M1; M3,M4→M2
  const mn = match.matchNumber ?? 1

  // Rasti kiek mačų yra sekančiame raunde
  const nextRoundCount = await prisma.match.count({
    where: { tournamentId: match.tournamentId, round: nextRound },
  })
  const currentRoundCount = await prisma.match.count({
    where: { tournamentId: match.tournamentId, round: match.round ?? '' },
  })

  let nextPosition: number
  if (nextRound === 'GF') {
    nextPosition = 1
  } else if (isLB && nextRoundCount >= currentRoundCount) {
    // LB vienodo arba didesnio dydžio raundai → tiesiai M1→M1, M2→M2
    nextPosition = mn
  } else if (nextRoundCount < currentRoundCount) {
    // Mažesnis sekantis raundas → ceil(mn/2)
    nextPosition = Math.ceil(mn / 2)
  } else {
    // WB standartinis → ceil(mn/2)
    nextPosition = Math.ceil(mn / 2)
  }
  const nextMatch    = await prisma.match.findFirst({
    where: { tournamentId: match.tournamentId, round: nextRound, matchNumber: nextPosition },
  })
  if (!nextMatch) return

  // Sloto parinkimas:
  // LB vienodo dydžio raundai (M1→M1): LB laimėtojas → home, WB pralaimėjusysis → away
  // WB ir mažėjantys raundai: nelyginiai → home, lyginiai → away
  let slot: 'homeTeamId' | 'awayTeamId'
  if (nextRound === 'GF') {
    // GF: WB laimėtojas → home, LB laimėtojas → away
    slot = isLB ? 'awayTeamId' : 'homeTeamId'
  } else if (nextRound === 'LB-SF' && !isLB) {
    // WB-SF laimėtojas (12 kom.) → LB-SF away slotą
    // (LB-SF home = LB-R4 laimėtojas per advanceWinner iš LB)
    slot = 'awayTeamId'
  } else if (isLB && nextRoundCount >= currentRoundCount) {
    // LB vienodo arba didesnio dydžio raundai: laimėtojas → home
    slot = 'homeTeamId'
  } else {
    slot = mn % 2 === 1 ? 'homeTeamId' : 'awayTeamId'
  }
  await prisma.match.update({
    where: { id: nextMatch.id },
    data:  { [slot]: match.winnerId },
  })

  // Vieno minuso / Lucky Loser formatuose SF pralaimėtojai žaidžia dėl 3 vietos.
  // Dviejų minusų formate SF pralaimėtojas dar tęsia kelią per LB ir gali patekti į GF.
  if (match.round === 'SF' && format !== 'DOUBLE_ELIMINATION') {
    const loserId = match.winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
    if (loserId) {
      const thirdMatch = await prisma.match.findFirst({
        where: { tournamentId: match.tournamentId, round: '3rd' },
      })
      if (thirdMatch) {
        const thirdSlot = !thirdMatch.homeTeamId ? 'homeTeamId' : 'awayTeamId'
        await prisma.match.update({
          where: { id: thirdMatch.id },
          data:  { [thirdSlot]: loserId },
        })
      }
    }
  }
}
