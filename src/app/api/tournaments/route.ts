import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr } from '@/lib/middleware/auth'
import { z }                     from 'zod'

const CreateSchema = z.object({
  name:      z.string().min(1).max(100),
  organizer: z.string().max(100).optional(),
  location:  z.string().max(200).optional(),
  startsAt:  z.string().datetime(),
  category:  z.enum(['M', 'W', 'X']),
  ageGroup:  z.enum(['U18','U21','U23','OPEN','PLUS40','PLUS50']).optional(),
})

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startsAt: 'desc' },
    include: { _count: { select: { teams: true, groups: true } } },
  })
  return jsonOk(tournaments.map(t => ({
    id: t.id, name: t.name, location: t.location, startsAt: t.startsAt,
    category: t.category, status: t.status,
    teamCount: t._count.teams, groupCount: t._count.groups,
  })))
}

export const POST = withAuth(async (req: NextRequest) => {
  const body  = await req.json()
  const parse = CreateSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)
  const d = parse.data
  const tournament = await prisma.tournament.create({
    data: { name: d.name, organizer: d.organizer, location: d.location, startsAt: new Date(d.startsAt), category: d.category, ageGroup: d.ageGroup },
  })
  return jsonOk(tournament, 201)
})
