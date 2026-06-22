import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, getParam } from '@/lib/middleware/auth'
import { generateGroupSchedule } from '@/lib/tournament/schedule'
import { timeOnlyDate }           from '@/lib/timezone'

export async function GET(_req: NextRequest, ctx: any) {
  const tournamentId = getParam(ctx, 'id')
  const matches = await prisma.match.findMany({
    where:   { tournamentId, groupId: { not: null }, scheduledAt: { not: null } },
    orderBy: [{ scheduledAt: 'asc' }, { court: 'asc' }],
    include: {
      sets:     { orderBy: { setNumber: 'asc' } },
      homeTeam: { include: { team: true } },
      awayTeam: { include: { team: true } },
      group:    true,
    },
  })
  return jsonOk(matches)
}

export const POST = withAuth(async (req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')
  const contentType = req.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json')
    ? await req.json().catch(() => ({}))
    : Object.fromEntries(await req.formData())

  // Jei UI perduoda rankinį pradžios laiką — išsaugoti į config
  if (body.startTime) {
    await prisma.tournamentConfig.upsert({
      where:  { tournamentId },
      update: { groupStartsAt: timeOnlyDate(String(body.startTime)) },
      create: { tournamentId, groupStartsAt: timeOnlyDate(String(body.startTime)) },
    })
  }

  await generateGroupSchedule(tournamentId)
  if (contentType.includes('application/json')) return jsonOk({ generated: true })
  return Response.redirect(new URL(`/tournament/${tournamentId}/schedule`, req.url))
})
