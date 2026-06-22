import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getParam, jsonOk } from '@/lib/middleware/auth'

// Viešas tik skaitymo sąrašas. Rezultatai keičiami tik apsaugotame /sets route.
export async function GET(_req: NextRequest, ctx: any) {
  const tournamentId = getParam(ctx, 'id')
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ scheduledAt: 'asc' }, { matchOrder: 'asc' }, { matchNumber: 'asc' }],
    include: {
      sets: { orderBy: { setNumber: 'asc' } },
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      group: true,
    },
  })
  return jsonOk(matches)
}
