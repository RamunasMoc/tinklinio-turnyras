import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { advanceLoser, advanceStructuralByes, advanceWinner, assignMatchOrder, clearLastKnockoutResult, ensureDoubleElimFinalRounds, rebuildKnockoutProgress, repairInitialLoserRound, resetKnockoutProgressFromMatch } from '@/lib/bracket'
import { getParam, requireAuth } from '@/lib/middleware/auth'
import { recalcGroupStandings, winnerFromSets } from '@/lib/tournament/standings'
import { normalizeKOWinnerMode, rankedHomeWinsFromSeeds } from '@/lib/tournament/resultGeneration'

type SetData = { setNumber: number; homeScore: number; awayScore: number; isTiebreak: boolean }

const ROUND_WAVE_16: Record<string, number> = {
  LL: 0,
  R64: 1, R32: 1, R16: 1,
  QF: 2,
  'LB-R1': 3,
  'LB-R2': 4,
  SF: 5,
  'LB-R3': 6,
  'LB-R4': 7, 'LB-SF': 7,
  F: 8, 'LB-F': 8,
  '3rd': 9,
  GF: 10,
}

const ROUND_WAVE_8: Record<string, number> = {
  LL: 0,
  QF: 1,
  'LB-R1': 2,
  SF: 3,
  'LB-R2': 4,
  'LB-SF': 5,
  F: 6,
  'LB-F': 7,
  '3rd': 8,
  GF: 9,
}

function getRoundWave(matches: { round: string | null }[]) {
  return matches.some(m => m.round === 'R16') ? ROUND_WAVE_16 : ROUND_WAVE_8
}

function roundWaveValue(round: string | null | undefined, waveMap: Record<string, number>) {
  if (round?.startsWith('RR')) {
    const n = Number(round.slice(2))
    return Number.isFinite(n) && n > 0 ? n : 99
  }
  return waveMap[round ?? ''] ?? 99
}

function realKOMatches<T extends { id: string; round: string | null; status: string; scheduledAt: Date | null; homeTeamId: string | null; awayTeamId: string | null; matchNumber: number | null }>(matches: T[]) {
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

function randLoser(limit: number) {
  const max = limit - 2
  const min = Math.min(10, max - 1)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomSets(format: string, tbPts: number, forceHomeWins?: boolean): SetData[] {
  const limit = format.includes('15') ? 15 : 21
  const homeWins = forceHomeWins ?? Math.random() > 0.5

  if (format.startsWith('ONE_')) {
    return [{
      setNumber: 1,
      homeScore: homeWins ? limit : randLoser(limit),
      awayScore: homeWins ? randLoser(limit) : limit,
      isTiebreak: false,
    }]
  }

  if (Math.random() > 0.4) {
    return [
      { setNumber: 1, homeScore: homeWins ? limit : randLoser(limit), awayScore: homeWins ? randLoser(limit) : limit, isTiebreak: false },
      { setNumber: 2, homeScore: homeWins ? limit : randLoser(limit), awayScore: homeWins ? randLoser(limit) : limit, isTiebreak: false },
    ]
  }

  const s1Home = Math.random() > 0.5
  return [
    { setNumber: 1, homeScore: s1Home ? limit : randLoser(limit), awayScore: s1Home ? randLoser(limit) : limit, isTiebreak: false },
    { setNumber: 2, homeScore: s1Home ? randLoser(limit) : limit, awayScore: s1Home ? limit : randLoser(limit), isTiebreak: false },
    { setNumber: 3, homeScore: homeWins ? tbPts : randLoser(tbPts), awayScore: homeWins ? randLoser(tbPts) : tbPts, isTiebreak: true },
  ]
}

async function rankedHomeWins(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { seedRank: true } },
      awayTeam: { select: { seedRank: true } },
    },
  })
  const homeSeed = match?.homeTeam?.seedRank
  const awaySeed = match?.awayTeam?.seedRank
  return rankedHomeWinsFromSeeds(homeSeed, awaySeed)
}

async function saveSets(matchId: string, sets: SetData[]) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournament: { include: { config: true } } },
  })
  if (!match?.homeTeamId || !match.awayTeamId) return

  await prisma.set.deleteMany({ where: { matchId } })
  await prisma.set.createMany({ data: sets.map(s => ({ ...s, matchId })) })

  const mainSets = sets.filter(s => !s.isTiebreak)
  const homeSets = mainSets.filter(s => s.homeScore > s.awayScore).length
  const awaySets = mainSets.filter(s => s.awayScore > s.homeScore).length
  const winnerId = winnerFromSets(sets, match.homeTeamId, match.awayTeamId)
  const winnerChanged = !match.groupId && match.status === 'FINISHED' && match.winnerId !== winnerId
  const shouldPropagateKO = !match.groupId && !!winnerId && (match.status !== 'FINISHED' || winnerChanged)

  if (winnerChanged) {
    await resetKnockoutProgressFromMatch(matchId, false)
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { homeSets, awaySets, winnerId, status: 'FINISHED', finishedAt: new Date() },
  })

  if (match.groupId) {
    await recalcGroupStandings(match.groupId)
  } else if (shouldPropagateKO) {
    await advanceWinner(matchId)
    if (match.tournament.config?.knockoutFormat === 'DOUBLE_ELIMINATION') {
      await advanceLoser(matchId)
      await ensureDoubleElimFinalRounds(match.tournamentId)
    }
    await rebuildKnockoutProgress(match.tournamentId)
  }
}

async function clearMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return
  await prisma.set.deleteMany({ where: { matchId } })
  await prisma.match.update({
    where: { id: matchId },
    data: { homeSets: null, awaySets: null, winnerId: null, status: 'SCHEDULED', startedAt: null, finishedAt: null },
  })
  if (match.groupId) await recalcGroupStandings(match.groupId)
}

export async function POST(req: NextRequest, ctx: any) {
  const session = await requireAuth(['ADMIN'])
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const tournamentId = getParam(ctx, 'id')
  const form = await req.formData()
  const action = String(form.get('action') ?? '')
  const isKO = form.get('isKO') === 'true'
  const winnerMode = normalizeKOWinnerMode(form.get('winnerMode'))
  const redirectTo = new URL(`/tournament/${tournamentId}/${isKO ? 'knockout-results' : 'results'}`, req.url)

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { config: true },
  })
  if (!tournament?.config) return NextResponse.redirect(redirectTo)

  const format = isKO ? tournament.config.knockoutSetFormat : tournament.config.groupSetFormat
  const tbPts = isKO ? tournament.config.knockoutTiebreakPoints : tournament.config.groupTiebreakPoints

  if (action === 'randomOne') {
    const matchId = String(form.get('matchId') ?? '')
    if (matchId) {
      const forceHomeWins = isKO && winnerMode === 'ranked' ? await rankedHomeWins(matchId) : undefined
      await saveSets(matchId, randomSets(format, tbPts, forceHomeWins))
    }
    return NextResponse.redirect(redirectTo)
  }

  if (action === 'clearAll') {
    const doneMatches = await prisma.match.findMany({
      where: { tournamentId, groupId: isKO ? null : { not: null }, status: 'FINISHED' },
      select: { id: true, round: true, status: true, scheduledAt: true, homeTeamId: true, awayTeamId: true, matchNumber: true },
    })
    const done = isKO ? realKOMatches(doneMatches) : doneMatches
    for (const match of done) await clearMatch(match.id)
    return NextResponse.redirect(redirectTo)
  }

  if (action === 'clearLast' && isKO) {
    await clearLastKnockoutResult(tournamentId)
    if (tournament.config.knockoutFormat === 'DOUBLE_ELIMINATION') {
      await ensureDoubleElimFinalRounds(tournamentId)
      await repairInitialLoserRound(tournamentId)
      await advanceStructuralByes(tournamentId)
      await ensureDoubleElimFinalRounds(tournamentId)
      await assignMatchOrder(tournamentId)
    }
    await rebuildKnockoutProgress(tournamentId)
    return NextResponse.redirect(redirectTo)
  }

  if (action === 'randomAll') {
    if (isKO) {
      if (tournament.config.knockoutFormat === 'DOUBLE_ELIMINATION') {
        await ensureDoubleElimFinalRounds(tournamentId)
        await repairInitialLoserRound(tournamentId)
        await advanceStructuralByes(tournamentId)
        await ensureDoubleElimFinalRounds(tournamentId)
        await assignMatchOrder(tournamentId)
      }
      for (let i = 0; i < 40; i++) {
        if (tournament.config.knockoutFormat === 'DOUBLE_ELIMINATION') {
          await ensureDoubleElimFinalRounds(tournamentId)
          await repairInitialLoserRound(tournamentId)
          await advanceStructuralByes(tournamentId)
          await ensureDoubleElimFinalRounds(tournamentId)
          await assignMatchOrder(tournamentId)
        }
        const freshMatches = await prisma.match.findMany({
          where: { tournamentId, groupId: null },
          orderBy: [{ matchNumber: 'asc' }],
        })
        const roundWave = getRoundWave(freshMatches)
        const fillable = realKOMatches(freshMatches)
          .filter(m => m.status !== 'FINISHED' && m.homeTeamId && m.awayTeamId)
          .sort((a, b) => {
            const aw = roundWaveValue(a.round, roundWave)
            const bw = roundWaveValue(b.round, roundWave)
            if (aw !== bw) return aw - bw
            return (a.matchNumber ?? 0) - (b.matchNumber ?? 0)
          })
        if (fillable.length === 0) break

        const minWave = roundWaveValue(fillable[0].round, roundWave)
        const waveMatches = fillable.filter(m => roundWaveValue(m.round, roundWave) === minWave)
        for (const match of waveMatches) {
          const forceHomeWins = winnerMode === 'ranked' ? await rankedHomeWins(match.id) : undefined
          await saveSets(match.id, randomSets(format, tbPts, forceHomeWins))
        }
      }
    } else {
      const pending = await prisma.match.findMany({
        where: { tournamentId, groupId: { not: null }, status: { not: 'FINISHED' }, homeTeamId: { not: null }, awayTeamId: { not: null } },
        orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }],
      })
      for (const match of pending) await saveSets(match.id, randomSets(format, tbPts))
    }
  }

  return NextResponse.redirect(redirectTo)
}
