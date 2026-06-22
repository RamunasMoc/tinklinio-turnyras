import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { z }                     from 'zod'

const UpdateSchema = z.object({
  name:      z.string().min(1).max(200).optional(),
  organizer: z.string().max(200).nullable().optional(),
  location:  z.string().max(300).nullable().optional(),
  startsAt:  z.string().datetime().optional(),
  category:  z.enum(['M','W','X']).optional(),
  ageGroup:  z.enum(['U18','U21','U23','OPEN','PLUS40','PLUS50','PLUS100']).nullable().optional(),
  slug:      z.string().min(1).max(100).nullable().optional(),
  status:    z.enum(['DRAFT','OPEN','CLOSED','GROUPS','KNOCKOUT','FINISHED']).optional(),
})

export async function GET(_req: NextRequest, ctx: any) {
  const id = getParam(ctx, 'id')
  const t  = await prisma.tournament.findUnique({
    where:   { id },
    include: { config: true, _count: { select: { teams: true, groups: true, matches: true } } },
  })
  if (!t) return jsonErr('Nerasta', 404)
  return jsonOk(t)
}

export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
  const id    = getParam(ctx, 'id')
  const body  = await req.json()
  const parse = UpdateSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

  const d = parse.data
  const t = await prisma.tournament.update({
    where: { id },
    data: {
      ...(d.name      !== undefined && { name:      d.name }),
      ...(d.organizer !== undefined && { organizer: d.organizer }),
      ...(d.location  !== undefined && { location:  d.location }),
      ...(d.startsAt  !== undefined && { startsAt:  new Date(d.startsAt) }),
      ...(d.category  !== undefined && { category:  d.category }),
      ...(d.ageGroup  !== undefined && { ageGroup:  d.ageGroup }),
      ...(d.slug      !== undefined && { slug:      d.slug }),
      ...(d.status    !== undefined && { status:    d.status }),
    },
  })
  return jsonOk(t)
})

export const DELETE = withAuth(async (_req: NextRequest, ctx: any) => {
  const id = getParam(ctx, 'id')
  await prisma.tournament.delete({ where: { id } })
  return jsonOk({ deleted: id })
})
