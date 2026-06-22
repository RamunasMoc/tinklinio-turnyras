import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, getParam } from '@/lib/middleware/auth'

// POST /api/tournaments/[id]/groups/clear-matches
// Išvalo tik grupių mačus, setus ir statistiką — grupės ir komandos lieka

export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')

  await prisma.$transaction([
    // Išvalyti setus
    prisma.set.deleteMany({
      where: { match: { tournamentId, groupId: { not: null } } },
    }),
    // Išvalyti mačus
    prisma.match.deleteMany({
      where: { tournamentId, groupId: { not: null } },
    }),
    // Nuliniti statistiką
    prisma.tournamentTeam.updateMany({
      where: { tournamentId },
      data: {
        groupPoints:  0,
        groupWins:    0,
        groupLosses:  0,
        groupSetsWon: 0,
        groupSetsLost:0,
        groupPtsWon:  0,
        groupPtsLost: 0,
      },
    }),
  ])

  return jsonOk({ cleared: true })
})
