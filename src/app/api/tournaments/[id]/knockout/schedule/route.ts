import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getParam, requireAuth } from '@/lib/middleware/auth'
import { combineDateAndTimeInZone } from '@/lib/timezone'

const ROUND_WAVE_16: Record<string, number> = {
  LL:      0,
  R64:     1, R32:    1, R16:    1,
  QF:      2,
  'LB-R1': 3,
  'LB-R2': 4,
  SF:      5,
  'LB-R3': 6,
  'LB-R4': 7, 'LB-R5': 7, 'LB-SF': 7,
  F:       8, 'LB-F': 8,
  '3rd':   9,
  GF:      10,
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

const ROUND_WAVE_12_CUSTOM: Record<string, number> = {
  R16: 1,
  QF: 2,
  'LB-R1': 3,
  SF: 4,
  'LB-R2': 5,
  'LB-R3': 6,
  'LB-R4': 7,
  '3rd': 8,
  GF: 9,
}

function isCustom12DoubleElim(matches: any[]) {
  const count = (round: string) => matches.filter(m => m.round === round).length
  return count('R16') === 4 && count('QF') === 4 && count('SF') === 2 &&
    count('LB-R1') === 4 && count('LB-R2') === 2 && count('LB-R3') === 2 &&
    count('LB-R4') === 2 && count('GF') === 1 && count('F') === 0 &&
    count('LB-F') === 0 && count('LB-SF') === 0
}

function getRoundWave(matches: any[]) {
  if (isCustom12DoubleElim(matches)) return ROUND_WAVE_12_CUSTOM
  return matches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8
}

function roundWaveValue(round: string | null | undefined, waveMap: Record<string, number>) {
  if (round?.startsWith('RR')) {
    const n = Number(round.slice(2))
    return Number.isFinite(n) && n > 0 ? n : 99
  }
  return waveMap[round ?? ''] ?? 99
}

function roundToQuarterHour(d: Date) {
  const rounded = Math.ceil(d.getMinutes() / 15) * 15
  d.setMinutes(rounded, 0, 0)
  return d
}

function realKOMatches(matches: any[]) {
  if (isCustom12DoubleElim(matches)) {
    return matches.filter(m => !(m.status === 'FINISHED' && (!m.homeTeamId || !m.awayTeamId)))
  }

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

async function getAutoStartTime(tournamentId: string, fallbackDate: Date) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { config: true },
  })
  const groupDuration = tournament?.config?.groupTimeMinutes ?? 45
  const last = await prisma.match.findFirst({
    where: { tournamentId, groupId: { not: null }, scheduledAt: { not: null } },
    orderBy: { scheduledAt: 'desc' },
  })

  if (last?.scheduledAt) {
    const end = new Date(last.scheduledAt)
    end.setMinutes(end.getMinutes() + groupDuration + 30)
    return roundToQuarterHour(end)
  }

  if (tournament?.config?.knockoutStartsAt) {
    return new Date(tournament.config.knockoutStartsAt)
  }

  return combineDateAndTimeInZone(tournament?.startsAt ?? fallbackDate, '15:00')
}

export async function POST(req: NextRequest, ctx: any) {
  const session = await requireAuth(['ADMIN'])
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const tournamentId = getParam(ctx, 'id')
  const form = await req.formData()
  const courtsCount = Math.max(1, Number(form.get('courts') ?? 2))
  const matchMs = Math.max(15, Number(form.get('duration') ?? 60)) * 60 * 1000
  const breakMs = Math.max(0, Number(form.get('breakMin') ?? 0)) * 60 * 1000
  const startsAt = form.get('startsAt') ? new Date(String(form.get('startsAt'))) : new Date()
  const startTime = await getAutoStartTime(tournamentId, startsAt)

  const allMatches = await prisma.match.findMany({
    where: { tournamentId, groupId: null },
    orderBy: [{ matchNumber: 'asc' }],
  })

  const roundWave = getRoundWave(allMatches)
  const sorted = [...allMatches].sort((a, b) => {
    const wa = roundWaveValue(a.round, roundWave)
    const wb = roundWaveValue(b.round, roundWave)
    if (wa !== wb) return wa - wb
    return (a.matchNumber ?? 0) - (b.matchNumber ?? 0)
  })
  const toSchedule = realKOMatches(sorted).filter(m => m.status !== 'FINISHED')

  const courtFree = new Map<number, number>()
  for (let i = 1; i <= courtsCount; i++) courtFree.set(i, startTime.getTime())

  let currentWave = -1
  for (const m of toSchedule) {
    const wave = roundWaveValue(m.round, roundWave)
    if (wave !== currentWave) {
      currentWave = wave
      const waveStartTime = Math.max(...Array.from(courtFree.values()))
      for (let i = 1; i <= courtsCount; i++) courtFree.set(i, waveStartTime)
    }

    let bestCourt = 1
    let bestStart = courtFree.get(1) ?? startTime.getTime()
    for (let i = 1; i <= courtsCount; i++) {
      const t = courtFree.get(i) ?? startTime.getTime()
      if (t < bestStart) {
        bestStart = t
        bestCourt = i
      }
    }

    courtFree.set(bestCourt, bestStart + matchMs + breakMs)
    await prisma.match.update({
      where: { id: m.id },
      data: { court: bestCourt, scheduledAt: new Date(bestStart) },
    })
  }

  return NextResponse.redirect(new URL(`/tournament/${tournamentId}/knockout-schedule`, req.url))
}
