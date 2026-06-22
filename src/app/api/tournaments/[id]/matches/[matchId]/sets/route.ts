import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { recalcGroupStandings, winnerFromSets } from '@/lib/tournament/standings'
import { advanceWinner, advanceLoser, ensureDoubleElimFinalRounds } from '@/lib/bracket'
import { z }                     from 'zod'

const SetSchema = z.object({
  setNumber:  z.number().int().min(1).max(3),
  homeScore:  z.number().int().min(0).max(30),
  awayScore:  z.number().int().min(0).max(30),
  isTiebreak: z.boolean(),
})

const ResultSchema = z.object({
  sets:      z.array(SetSchema).max(3),
  startedAt: z.string().datetime().optional(),
})

export const PUT = withAuth(async (req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')
  const matchId      = getParam(ctx, 'matchId')

  const body  = await req.json()
  const parse = ResultSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

  const { sets, startedAt } = parse.data

  const match = await prisma.match.findUnique({
    where:   { id: matchId },
    include: { tournament: { include: { config: true } } },
  })
  if (!match) return jsonErr('Rungtynės nerastos', 404)
  if (match.tournamentId !== tournamentId) return jsonErr('Prieiga uždrausta', 403)

  await prisma.set.deleteMany({ where: { matchId } })

  // sets: [] — išvalyti rezultatus
  if (sets.length === 0) {
    await prisma.match.update({
      where: { id: matchId },
      data:  { homeSets: null, awaySets: null, winnerId: null,
               status: 'SCHEDULED', startedAt: null, finishedAt: null },
    })
    if (match.groupId) await recalcGroupStandings(match.groupId)
    const updated = await prisma.match.findUnique({
      where: { id: matchId }, include: { sets: { orderBy: { setNumber: 'asc' } } }
    })
    return jsonOk(updated)
  }

  await prisma.set.createMany({ data: sets.map(s => ({ ...s, matchId })) })

  const mainSets = sets.filter(s => !s.isTiebreak)
  const homeSets = mainSets.filter(s => s.homeScore > s.awayScore).length
  const awaySets = mainSets.filter(s => s.awayScore > s.homeScore).length

  const winnerId = winnerFromSets(sets, match.homeTeamId, match.awayTeamId)

  await prisma.match.update({
    where: { id: matchId },
    data:  {
      homeSets, awaySets, winnerId, status: 'FINISHED',
      startedAt:  startedAt ? new Date(startedAt) : undefined,
      finishedAt: new Date(),
    },
  })

  if (match.groupId) await recalcGroupStandings(match.groupId)
  if (!match.groupId && winnerId) {
    await advanceWinner(matchId)
    // DE formate: WB pralaimėtojas patenka į LB
    if (match.tournament?.config?.knockoutFormat === 'DOUBLE_ELIMINATION') {
      await advanceLoser(matchId)
      await ensureDoubleElimFinalRounds(tournamentId)
    }
  }

  const updated = await prisma.match.findUnique({
    where: { id: matchId }, include: { sets: { orderBy: { setNumber: 'asc' } } }
  })
  return jsonOk(updated)
}, ['ADMIN'])
