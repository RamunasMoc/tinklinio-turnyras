export type KnockoutStandingTeam = {
  id: string
  name: string
  club?: string | null
  seed?: number | null
}

export type KnockoutStandingMatch = {
  id?: string
  round?: string | null
  matchOrder?: number | null
  matchNumber?: number | null
  status: string
  homeTeamId?: string | null
  awayTeamId?: string | null
  winnerId?: string | null
  homeSets?: number | null
  awaySets?: number | null
  sets?: Array<{
    homeScore: number
    awayScore: number
    isTiebreak?: boolean
  }>
}

export type KnockoutStandingRow = KnockoutStandingTeam & {
  place: string
  statusLabel: string
  played: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  pointsWon: number
  pointsLost: number
  setRatio: number
  pointRatio: number
  pointDiff: number
}

export type KnockoutStandingsResult = {
  rows: KnockoutStandingRow[]
  complete: boolean
}

type WorkingRow = KnockoutStandingTeam & {
  played: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  pointsWon: number
  pointsLost: number
  lastRound: string | null
  lastOrder: number
  eliminationRound: string | null
  eliminationOrder: number
}

const ROUND_WEIGHT: Record<string, number> = {
  LL: 0,
  R64: 1,
  R32: 2,
  R16: 3,
  QF: 4,
  'LB-R1': 5,
  'LB-R2': 6,
  SF: 7,
  'LB-R3': 8,
  'LB-R4': 9,
  'LB-SF': 10,
  F: 11,
  'LB-F': 12,
  '3rd': 13,
  GF: 14,
}

const ROUND_LABEL: Record<string, string> = {
  LL: 'Lucky Loser',
  R64: '1/32',
  R32: '1/16',
  R16: '1/8',
  QF: 'Ketvirtfinaliai',
  SF: 'Pusfinaliai',
  F: 'Finalas',
  GF: 'Grand finalas',
  '3rd': 'Dėl 3 vietos',
  'LB-R1': 'Pralaimėtojų 1 etapas',
  'LB-R2': 'Pralaimėtojų 2 etapas',
  'LB-R3': 'Pralaimėtojų 3 etapas',
  'LB-R4': 'Pralaimėtojų 4 etapas',
  'LB-SF': 'Pralaimėtojų pusfinalis',
  'LB-F': 'Pralaimėtojų finalas',
}

function ratio(won: number, lost: number) {
  if (lost > 0) return won / lost
  return won > 0 ? Number.POSITIVE_INFINITY : 0
}

function roundWeight(round: string | null | undefined) {
  if (!round) return -1
  if (/^RR\d+$/.test(round)) return Number(round.slice(2))
  return ROUND_WEIGHT[round] ?? -1
}

function winnerAndLoser(match: KnockoutStandingMatch) {
  if (!match.homeTeamId || !match.awayTeamId || match.status !== 'FINISHED') return null
  if (match.winnerId === match.homeTeamId) return { winnerId: match.homeTeamId, loserId: match.awayTeamId }
  if (match.winnerId === match.awayTeamId) return { winnerId: match.awayTeamId, loserId: match.homeTeamId }

  const sets = match.sets ?? []
  const homeWon = sets.filter(set => set.homeScore > set.awayScore).length || Number(match.homeSets ?? 0)
  const awayWon = sets.filter(set => set.awayScore > set.homeScore).length || Number(match.awaySets ?? 0)
  if (homeWon === awayWon) return null
  return homeWon > awayWon
    ? { winnerId: match.homeTeamId, loserId: match.awayTeamId }
    : { winnerId: match.awayTeamId, loserId: match.homeTeamId }
}

function compareStats(a: WorkingRow, b: WorkingRow) {
  if (b.wins !== a.wins) return b.wins - a.wins
  const setRatio = ratio(b.setsWon, b.setsLost) - ratio(a.setsWon, a.setsLost)
  if (Number.isFinite(setRatio) && Math.abs(setRatio) > 0.0001) return setRatio
  if (!Number.isFinite(setRatio) && ratio(a.setsWon, a.setsLost) !== ratio(b.setsWon, b.setsLost)) {
    return ratio(b.setsWon, b.setsLost) === Number.POSITIVE_INFINITY ? 1 : -1
  }
  const pointRatio = ratio(b.pointsWon, b.pointsLost) - ratio(a.pointsWon, a.pointsLost)
  if (Number.isFinite(pointRatio) && Math.abs(pointRatio) > 0.0001) return pointRatio
  if (b.pointsWon - b.pointsLost !== a.pointsWon - a.pointsLost) {
    return (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost)
  }
  return (a.seed ?? 9999) - (b.seed ?? 9999)
}

export function buildKnockoutStandings(
  teams: KnockoutStandingTeam[],
  matches: KnockoutStandingMatch[],
  format?: string | null,
): KnockoutStandingsResult {
  const rows = new Map<string, WorkingRow>()
  for (const team of teams) {
    rows.set(team.id, {
      ...team,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsWon: 0,
      pointsLost: 0,
      lastRound: null,
      lastOrder: -1,
      eliminationRound: null,
      eliminationOrder: -1,
    })
  }

  const finished = matches
    .filter(match => match.status === 'FINISHED' && match.homeTeamId && match.awayTeamId)
    .sort((a, b) => {
      const orderDiff = Number(a.matchOrder ?? 9999) - Number(b.matchOrder ?? 9999)
      if (orderDiff !== 0) return orderDiff
      const roundDiff = roundWeight(a.round) - roundWeight(b.round)
      if (roundDiff !== 0) return roundDiff
      return Number(a.matchNumber ?? 0) - Number(b.matchNumber ?? 0)
    })

  for (const match of finished) {
    const result = winnerAndLoser(match)
    if (!result) continue
    const home = rows.get(match.homeTeamId!)
    const away = rows.get(match.awayTeamId!)
    const winner = rows.get(result.winnerId)
    const loser = rows.get(result.loserId)
    if (!home || !away || !winner || !loser) continue

    const mainSets = (match.sets ?? []).filter(set => !set.isTiebreak)
    const homeSetsWon = mainSets.filter(set => set.homeScore > set.awayScore).length
    const awaySetsWon = mainSets.filter(set => set.awayScore > set.homeScore).length

    home.played += 1
    away.played += 1
    winner.wins += 1
    loser.losses += 1
    home.setsWon += homeSetsWon
    home.setsLost += awaySetsWon
    away.setsWon += awaySetsWon
    away.setsLost += homeSetsWon

    for (const set of mainSets) {
      home.pointsWon += set.homeScore
      home.pointsLost += set.awayScore
      away.pointsWon += set.awayScore
      away.pointsLost += set.homeScore
    }

    const order = Number(match.matchOrder ?? roundWeight(match.round) * 100 + Number(match.matchNumber ?? 0))
    for (const row of [home, away]) {
      if (order >= row.lastOrder) {
        row.lastOrder = order
        row.lastRound = match.round ?? null
      }
    }

    if (match.round !== '3rd' && format !== 'ROUND_ROBIN') {
      const eliminated = format === 'DOUBLE_ELIMINATION' ? loser.losses >= 2 : true
      if (eliminated) {
        loser.eliminationRound = match.round ?? null
        loser.eliminationOrder = order
      }
    }
  }

  const rowValues = [...rows.values()]
  if (format === 'ROUND_ROBIN') {
    rowValues.sort(compareStats)
    const rrMatches = matches.filter(match => /^RR\d+$/.test(match.round ?? '') && match.homeTeamId && match.awayTeamId)
    const complete = rrMatches.length > 0 && rrMatches.every(match => match.status === 'FINISHED')
    return {
      complete,
      rows: rowValues.map((row, index) => toResultRow(row, String(index + 1), index === 0 ? '1 vieta' : `${index + 1} vieta`)),
    }
  }

  const finalRound = format === 'DOUBLE_ELIMINATION' ? 'GF' : 'F'
  const finalMatch = [...finished].reverse().find(match => match.round === finalRound)
  const finalResult = finalMatch ? winnerAndLoser(finalMatch) : null
  const thirdMatch = [...finished].reverse().find(match => match.round === '3rd')
  const thirdResult = thirdMatch ? winnerAndLoser(thirdMatch) : null
  const fixedPlaces = new Map<string, number>()
  if (finalResult) {
    fixedPlaces.set(finalResult.winnerId, 1)
    fixedPlaces.set(finalResult.loserId, 2)
  }
  if (thirdResult && !fixedPlaces.has(thirdResult.winnerId) && !fixedPlaces.has(thirdResult.loserId)) {
    fixedPlaces.set(thirdResult.winnerId, 3)
    fixedPlaces.set(thirdResult.loserId, 4)
  }

  rowValues.sort((a, b) => {
    const aFixed = fixedPlaces.get(a.id)
    const bFixed = fixedPlaces.get(b.id)
    if (aFixed || bFixed) return (aFixed ?? 999) - (bFixed ?? 999)
    const aActive = !a.eliminationRound
    const bActive = !b.eliminationRound
    if (aActive !== bActive) return aActive ? -1 : 1
    if (b.eliminationOrder !== a.eliminationOrder) return b.eliminationOrder - a.eliminationOrder
    const stageDiff = roundWeight(b.eliminationRound) - roundWeight(a.eliminationRound)
    if (stageDiff !== 0) return stageDiff
    return compareStats(a, b)
  })

  const complete = Boolean(finalResult) && !matches.some(match =>
    match.round === '3rd' && match.homeTeamId && match.awayTeamId && match.status !== 'FINISHED'
  )
  const placeLabels = new Map<string, string>()
  for (const [id, place] of fixedPlaces) placeLabels.set(id, String(place))

  for (let index = 0; index < rowValues.length;) {
    const row = rowValues[index]
    if (placeLabels.has(row.id)) {
      index += 1
      continue
    }
    if (!row.eliminationRound) {
      placeLabels.set(row.id, '—')
      index += 1
      continue
    }
    const group = rowValues.slice(index).filter(candidate =>
      !placeLabels.has(candidate.id) && candidate.eliminationRound === row.eliminationRound
    )
    const startPlace = index + 1
    const endPlace = startPlace + group.length - 1
    const label = group.length > 1 ? `${startPlace}–${endPlace}` : String(startPlace)
    for (const candidate of group) placeLabels.set(candidate.id, label)
    index += group.length
  }

  return {
    complete,
    rows: rowValues.map(row => {
      const fixed = fixedPlaces.get(row.id)
      const statusLabel = fixed === 1
        ? 'Čempionai'
        : fixed === 2
          ? 'Finalas'
          : fixed === 3
            ? '3 vieta'
            : fixed === 4
              ? '4 vieta'
              : row.eliminationRound
                ? ROUND_LABEL[row.eliminationRound] ?? row.eliminationRound
                : row.played > 0
                  ? 'Tęsia kovą'
                  : 'Dar nežaidė'
      return toResultRow(row, placeLabels.get(row.id) ?? '—', statusLabel)
    }),
  }
}

function toResultRow(row: WorkingRow, place: string, statusLabel: string): KnockoutStandingRow {
  return {
    id: row.id,
    name: row.name,
    club: row.club,
    seed: row.seed,
    place,
    statusLabel,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    setsWon: row.setsWon,
    setsLost: row.setsLost,
    pointsWon: row.pointsWon,
    pointsLost: row.pointsLost,
    setRatio: ratio(row.setsWon, row.setsLost),
    pointRatio: ratio(row.pointsWon, row.pointsLost),
    pointDiff: row.pointsWon - row.pointsLost,
  }
}
