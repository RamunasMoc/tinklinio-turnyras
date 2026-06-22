import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, getParam } from '@/lib/middleware/auth'

// POST /api/tournaments/[id]/knockout/clear
// Ištrina tik KO mačus ir setus, grupės lieka nepakeistos

export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')

  await prisma.set.deleteMany({
    where: { match: { tournamentId, groupId: null } },
  })

  await prisma.match.deleteMany({
    where: { tournamentId, groupId: null },
  })

  await prisma.tournament.update({
    where: { id: tournamentId },
    data:  { status: 'GROUPS' },
  })

  return jsonOk({ cleared: true })
})
