import { NextRequest }                         from 'next/server'
import { prisma }                              from '@/lib/prisma'
import { withAuth, jsonOk, getParam }          from '@/lib/middleware/auth'

// POST /api/tournaments/[id]/groups/clear
// Ištrina visas grupes, mačus ir nulinuoja statistiką

export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')

  // 1. Ištrinti visus mačų setus
  await prisma.set.deleteMany({
    where: { match: { tournamentId } },
  })

  // 2. Ištrinti visus mačus
  await prisma.match.deleteMany({ where: { tournamentId } })

  // 3. Nulinuoti komandų statistiką ir grupių priskyrimus
  await prisma.tournamentTeam.updateMany({
    where: { tournamentId },
    data: {
      groupId:       null,
      groupWins:     0,
      groupLosses:   0,
      groupPoints:   0,
      groupSetsWon:  0,
      groupSetsLost: 0,
      groupPtsWon:   0,
      groupPtsLost:  0,
    },
  })

  // 4. Ištrinti grupes
  await prisma.group.deleteMany({ where: { tournamentId } })

  // 5. Grąžinti turnyro statusą į CLOSED (buvo GROUPS arba KNOCKOUT)
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } })
  if (t && ['GROUPS', 'KNOCKOUT', 'FINISHED'].includes(t.status)) {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data:  { status: 'CLOSED' },
    })
  }

  return jsonOk({ cleared: true })
})
