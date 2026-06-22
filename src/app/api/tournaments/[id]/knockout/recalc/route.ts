import { NextRequest } from 'next/server'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { prisma } from '@/lib/prisma'
import { advanceStructuralByes, assignMatchOrder, ensureDoubleElimFinalRounds, repairInitialLoserRound } from '@/lib/bracket'

export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { config: true },
  })
  if (!tournament) return jsonErr('Turnyras nerastas', 404)

  let moved = 0
  if (tournament.config?.knockoutFormat === 'DOUBLE_ELIMINATION') {
    moved += await ensureDoubleElimFinalRounds(tournamentId)
    moved += await repairInitialLoserRound(tournamentId)
    moved += await advanceStructuralByes(tournamentId)
    moved += await ensureDoubleElimFinalRounds(tournamentId)
    await assignMatchOrder(tournamentId)
  }

  return jsonOk({ moved })
}, ['ADMIN'])
