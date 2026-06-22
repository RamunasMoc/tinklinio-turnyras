import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { z }                     from 'zod'

const ConfigSchema = z.object({
  numGroups:              z.number().int().min(1).max(32),
  advancePerGroup:        z.number().int().min(1).max(20).optional().default(2),
  advanceTotal:           z.number().int().min(2).max(128).optional().default(8),
  advanceMode:            z.enum(['fixed','total']).optional().default('fixed'),
  groupSetFormat:         z.enum(['BO2_21','BO2_15','ONE_21','ONE_15']),
  groupTiebreakPoints:    z.number().int().refine(n => [11,15].includes(n)),
  groupTimeMinutes:       z.number().int().min(15).max(180),
  groupCourts:            z.number().int().min(1).max(20),
  groupPointSystem:       z.enum(['WIN_LOSS','TWO_ONE','SET_RATIO']),
  groupBreakMinutes:      z.number().int().min(0).max(60),
  drawMethod:             z.enum(['RANDOM','SEEDED_RANDOM','SNAKE','MANUAL']),
  numSeeds:               z.number().int().min(0).optional().default(0),
  clubRule:               z.boolean(),
  knockoutFormat:         z.enum(['SINGLE_ELIMINATION','LUCKY_LOSER','DOUBLE_ELIMINATION','ROUND_ROBIN']),
  knockoutSetFormat:      z.enum(['BO2_21','BO2_15','ONE_21','ONE_15']),
  knockoutTiebreakPoints: z.number().int().refine(n => [11,15].includes(n)),
  finalSetFormat:         z.enum(['BO2_21','BO2_15','ONE_21','ONE_15']),
  knockoutTimeMinutes:    z.number().int().min(15).max(180),
  knockoutCourts:         z.number().int().min(1).max(20),
  thirdPlaceMatch:        z.boolean(),
  knockoutStartsAt:       z.string().datetime().optional().nullable(),
  lunchBreakMinutes:      z.number().int().min(0).max(120).optional().nullable(),
  groupStartsAt:          z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, ctx: any) {
  const id  = getParam(ctx, 'id')
  const cfg = await prisma.tournamentConfig.findUnique({ where: { tournamentId: id } })
  if (!cfg) return jsonErr('Konfigūracija nerasta', 404)
  return jsonOk(cfg)
}

export const PUT = withAuth(async (req: NextRequest, ctx: any) => {
  const id    = getParam(ctx, 'id')
  const body  = await req.json()
  const parse = ConfigSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

  const d = parse.data
  const cfg = await prisma.tournamentConfig.upsert({
    where:  { tournamentId: id },
    create: {
      tournamentId: id, ...d,
      knockoutStartsAt: d.knockoutStartsAt ? new Date(d.knockoutStartsAt) : null,
      groupStartsAt:   d.groupStartsAt    ? new Date(`1970-01-01T${d.groupStartsAt}:00`) : null,
    },
    update: {
      ...d,
      knockoutStartsAt: d.knockoutStartsAt ? new Date(d.knockoutStartsAt) : null,
      groupStartsAt:   d.groupStartsAt    ? new Date(`1970-01-01T${d.groupStartsAt}:00`) : null,
    },
  })
  return jsonOk(cfg)
})
