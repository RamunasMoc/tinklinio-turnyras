import { prisma } from '../prisma'
import { combineDateAndTimeInZone, timeOnlyString } from '../timezone'

export async function generateGroupSchedule(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      config: true,
      groups: { include: { teams: true }, orderBy: { order: 'asc' } },
    },
  })
  if (!tournament?.config) throw new Error('Nėra konfigūracijos')

  const cfg     = tournament.config
  const matchMs = cfg.groupTimeMinutes * 60 * 1000
  const breakMs = cfg.groupBreakMinutes * 60 * 1000
  const courts  = cfg.groupCourts
  // Naudoti groupStartsAt jei nustatytas, kitaip tournament.startsAt
  const startDate = cfg.groupStartsAt
    ? combineDateAndTimeInZone(
        tournament.startsAt,
        timeOnlyString(cfg.groupStartsAt, '09:00'),
      )
    : tournament.startsAt
  const start = startDate.getTime()

  await prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } })

  const plan = buildGroupSchedulePlan(
    tournament.groups.map(group => ({
      id:      group.id,
      teamIds: group.teams.map(team => team.id),
    })),
    courts,
    start,
    matchMs,
    breakMs,
  )

  for (const item of plan) {
    await prisma.match.create({
      data: {
        tournamentId,
        groupId:     item.groupId,
        homeTeamId:  item.homeId,
        awayTeamId:  item.awayId,
        court:       item.court,
        scheduledAt: new Date(item.scheduledAt),
        matchNumber: item.matchNumber,
      },
    })
  }
}

type ScheduleGroup = { id: string; teamIds: string[] }
type Pair = { groupId: string; homeId: string; awayId: string; round: number; order: number }
type PlannedMatch = {
  groupId: string
  homeId: string
  awayId: string
  court: number
  scheduledAt: number
  matchNumber: number
}

export function buildGroupSchedulePlan(
  groups: ScheduleGroup[],
  courts: number,
  start: number,
  matchMs: number,
  breakMs: number,
): PlannedMatch[] {
  const groupedPairs = groups.map(group => ({
    groupId: group.id,
    pairs:   pairsForGroup(group.id, group.teamIds),
  }))

  const plan = groups.length === courts
    ? planDedicatedGroupCourts(groupedPairs, courts, start, matchMs, breakMs)
    : planGreedyGroupCourts(groupedPairs, courts, start, matchMs, breakMs)

  return plan
    .sort((a, b) => a.scheduledAt - b.scheduledAt || a.court - b.court)
    .map((match, index) => ({ ...match, matchNumber: index + 1 }))
}

function pairsForGroup(groupId: string, teamIds: string[]): Pair[] {
  const pairs: Pair[] = []
  const rounds = bergerRounds(teamIds)
  rounds.forEach((round, ri) => {
    round.forEach(([a, b], order) => {
      pairs.push({ groupId, homeId: a, awayId: b, round: ri, order })
    })
  })
  return pairs
}

function planGreedyGroupCourts(
  groups: { groupId: string; pairs: Pair[] }[],
  courts: number,
  start: number,
  matchMs: number,
  breakMs: number,
): PlannedMatch[] {
  const pairs = groups.flatMap(group => group.pairs).sort((a, b) => a.round - b.round || a.order - b.order)
  const courtFree = Array(courts).fill(start)
  const teamFree = initTeamFree(groups, start)
  const plan: PlannedMatch[] = []

  for (const pair of pairs) {
    const teamReady = Math.max(teamFree[pair.homeId] ?? start, teamFree[pair.awayId] ?? start)
    let bestCourt = 0
    let bestStart = Math.max(courtFree[0], teamReady)

    for (let i = 1; i < courts; i++) {
      const s = Math.max(courtFree[i], teamReady)
      if (s < bestStart) { bestStart = s; bestCourt = i }
    }

    reserveMatch(pair, bestCourt, bestStart, courtFree, teamFree, plan, matchMs, breakMs)
  }

  return plan
}

function planDedicatedGroupCourts(
  groups: { groupId: string; pairs: Pair[] }[],
  courts: number,
  start: number,
  matchMs: number,
  breakMs: number,
): PlannedMatch[] {
  const queues = groups.map(group => ({ ...group, pairs: [...group.pairs] }))
  const courtFree = Array(courts).fill(start)
  const teamFree = initTeamFree(groups, start)
  const plan: PlannedMatch[] = []

  while (queues.some(group => group.pairs.length > 0)) {
    let best: { groupIndex: number; courtIndex: number; startTime: number } | null = null

    for (let groupIndex = 0; groupIndex < queues.length; groupIndex++) {
      const group = queues[groupIndex]
      const pair = group.pairs[0]
      if (!pair) continue

      for (const courtIndex of allowedCourtsForGroup(queues, groupIndex)) {
        const teamReady = Math.max(teamFree[pair.homeId] ?? start, teamFree[pair.awayId] ?? start)
        const startTime = Math.max(courtFree[courtIndex], teamReady)

        if (
          !best ||
          startTime < best.startTime ||
          (startTime === best.startTime && courtIndex === groupIndex && best.courtIndex !== best.groupIndex) ||
          (startTime === best.startTime && courtIndex < best.courtIndex)
        ) {
          best = { groupIndex, courtIndex, startTime }
        }
      }
    }

    if (!best) break

    const pair = queues[best.groupIndex].pairs.shift()
    if (!pair) continue
    reserveMatch(pair, best.courtIndex, best.startTime, courtFree, teamFree, plan, matchMs, breakMs)
  }

  return plan
}

function allowedCourtsForGroup(
  groups: { groupId: string; pairs: Pair[] }[],
  groupIndex: number,
): number[] {
  const courts = [groupIndex]
  groups.forEach((group, index) => {
    if (index !== groupIndex && group.pairs.length === 0) courts.push(index)
  })
  return courts
}

function initTeamFree(groups: { groupId: string; pairs: Pair[] }[], start: number) {
  const teamFree: Record<string, number> = {}
  for (const group of groups) {
    for (const pair of group.pairs) {
      teamFree[pair.homeId] = start
      teamFree[pair.awayId] = start
    }
  }
  return teamFree
}

function reserveMatch(
  pair: Pair,
  courtIndex: number,
  scheduledAt: number,
  courtFree: number[],
  teamFree: Record<string, number>,
  plan: PlannedMatch[],
  matchMs: number,
  breakMs: number,
) {
  const endsAt = scheduledAt + matchMs
  courtFree[courtIndex] = endsAt + breakMs
  teamFree[pair.homeId] = endsAt + breakMs
  teamFree[pair.awayId] = endsAt + breakMs
  plan.push({
    groupId: pair.groupId,
    homeId: pair.homeId,
    awayId: pair.awayId,
    court: courtIndex + 1,
    scheduledAt,
    matchNumber: 0,
  })
}

// ─── Berger lentelė ──────────────────────────────────────────
// Kiekvienas raundas garantuoja, kad komanda žaidžia tik vieną kartą.
// Jei nelyginis skaičius — viena komanda turi "bye" (praleidžia turą).

function bergerRounds(ids: string[]): [string, string][][] {
  const n    = ids.length % 2 === 0 ? ids.length : ids.length + 1
  const list = [...ids]
  if (list.length < n) list.push('__bye__')

  const rounds: [string, string][][] = []

  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a !== '__bye__' && b !== '__bye__') {
        round.push([a, b])
      }
    }
    rounds.push(round)

    // Rotacija: pirmasis fiksuotas, likusieji sukasi pagal laikrodžio rodyklę
    const last = list[n - 1]
    for (let i = n - 1; i > 1; i--) list[i] = list[i - 1]
    list[1] = last
  }

  return rounds
}
