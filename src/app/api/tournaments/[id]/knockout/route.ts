import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { generateBracket }       from '@/lib/bracket'
import { z }                     from 'zod'

const CourtSchema = z.object({
  courtId:       z.number().int(),
  name:          z.string(),
  availableFrom: z.string(), // datetime-local gali neturėti 'Z'
  autoAssign:    z.boolean(),
})

const ScheduleSchema = z.object({
  action:               z.literal('schedule'),
  courts:               z.array(CourtSchema).min(1),
  matchDurationMinutes: z.number().int().min(15),
  breakBetweenMinutes:  z.number().int().min(0),
})

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

function isCustom12DoubleElim(matches: any[]) {
  const count = (round: string) => matches.filter(m => m.round === round).length
  return count('R16') === 4 && count('QF') === 4 && count('SF') === 2 &&
    count('LB-R1') === 4 && count('LB-R2') === 2 && count('LB-R3') === 2 &&
    count('LB-R4') === 2 && count('GF') === 1 && count('F') === 0 &&
    count('LB-F') === 0 && count('LB-SF') === 0
}

function roundWaveValue(round: string | null | undefined, waveMap: Record<string, number>) {
  if (round?.startsWith('RR')) {
    const n = Number(round.slice(2))
    return Number.isFinite(n) && n > 0 ? n : 99
  }
  return waveMap[round ?? ''] ?? 99
}

export async function GET(_req: NextRequest, ctx: any) {
  const tournamentId = getParam(ctx, 'id')
  const matches = await prisma.match.findMany({
    where:   { tournamentId, groupId: null },
    orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
    include: {
      sets:     { orderBy: { setNumber: 'asc' } },
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
    },
  })
  return jsonOk(matches)
}

export const POST = withAuth(async (req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')
  const body = await req.json()

  // ── Generuoti braket ────────────────────────────────────
  if (body.action === 'generate') {
    try {
      await generateBracket(tournamentId)
    } catch (err: any) {
      return jsonErr(err?.message ?? 'Nepavyko sugeneruoti bracket', 400)
    }
    await prisma.tournament.update({
      where: { id: tournamentId },
      data:  { status: 'KNOCKOUT' },
    })
    return jsonOk({ generated: true })
  }

  // ── Generuoti tvarkaraštį ────────────────────────────────
  if (body.action === 'schedule') {
    const parse = ScheduleSchema.safeParse(body)
    if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

    const { courts, matchDurationMinutes, breakBetweenMinutes } = parse.data
    const matchMs   = matchDurationMinutes * 60 * 1000
    const breakMs   = breakBetweenMinutes  * 60 * 1000
    const startTime = new Date(courts[0].availableFrom).getTime()

    const allMatches = await prisma.match.findMany({
      where:   { tournamentId, groupId: null },
      orderBy: [{ matchNumber: 'asc' }],
    })

    if (allMatches.length === 0) return jsonErr('Braket nepageneruotas', 400)

    // Bangų tvarka Double Elimination / Single Elimination:
    // SVARBU: '3rd' (dėl 3 vietos) banga PRIEŠ Grand Finalą (GF)
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
      '3rd':   9,  // Dėl 3 vietos žaidžiama PRIEŠ Grand Finalą
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
    const roundWave = isCustom12DoubleElim(allMatches)
      ? ROUND_WAVE_12_CUSTOM
      : allMatches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8

    // Surūšiuoti pagal bangą, tada matchNumber
    const sorted = [...allMatches].sort((a, b) => {
      const wa = roundWaveValue(a.round, roundWave)
      const wb = roundWaveValue(b.round, roundWave)
      if (wa !== wb) return wa - wb
      return (a.matchNumber ?? 0) - (b.matchNumber ?? 0)
    })

    // Skip bye mačai (FINISHED be žaidimo)
    const toSchedule = realKOMatches(sorted).filter(m => m.status !== 'FINISHED')

    // Aikštelių laisvas nuo laiko
    const courtFree = new Map<number, number>()
    for (const c of courts) {
      courtFree.set(c.courtId, new Date(c.availableFrom).getTime())
    }

    let currentWave   = -1
    let waveStartTime = startTime

    for (const m of toSchedule) {
      const wave = roundWaveValue(m.round, roundWave)

      if (wave !== currentWave) {
        currentWave   = wave
        // Nauja banga prasideda kai visos aikštelės laisvos
        waveStartTime = Math.max(...Array.from(courtFree.values()))
        for (const c of courts) courtFree.set(c.courtId, waveStartTime)
      }

      // Rasti anksčiausiai laisvą aikštelę
      let bestCourt = courts[0].courtId
      let bestStart = courtFree.get(courts[0].courtId) ?? waveStartTime

      for (const c of courts) {
        const t = courtFree.get(c.courtId) ?? waveStartTime
        if (t < bestStart) { bestStart = t; bestCourt = c.courtId }
      }

      courtFree.set(bestCourt, bestStart + matchMs + breakMs)

      await prisma.match.update({
        where: { id: m.id },
        data:  { court: bestCourt, scheduledAt: new Date(bestStart) },
      })
    }

    return jsonOk({ scheduled: true })
  }

  return jsonErr('Nežinoma action', 400)
})
