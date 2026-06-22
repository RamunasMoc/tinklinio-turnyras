import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { z }                     from 'zod'

const UpdateSchema = z.object({
  name:    z.string().max(100).optional(),
  club:    z.string().max(100).nullable().optional(),
  rating:   z.number().int().min(0).nullable().optional(),
  teamAge:  z.number().int().min(0).nullable().optional(),
  seedRank: z.number().int().min(1).max(256).nullable().optional(),
  seeded:   z.boolean().optional(),
  groupId:  z.string().nullable().optional(),
  player1: z.object({
    firstName:   z.string().min(1).max(60),
    lastName:    z.string().min(1).max(60),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    ageYears:    z.number().int().min(5).max(100).nullable().optional(),
    shirtSize:   z.enum(['XS','S','M','L','XL','XXL']).nullable().optional(),
  }).optional(),
  player2: z.object({
    firstName:   z.string().min(1).max(60),
    lastName:    z.string().min(1).max(60),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    ageYears:    z.number().int().min(5).max(100).nullable().optional(),
    shirtSize:   z.enum(['XS','S','M','L','XL','XXL']).nullable().optional(),
  }).optional(),
})

export const PATCH = withAuth(async (req: NextRequest, ctx: any) => {
  const ttId = getParam(ctx, 'ttId')
  const body = await req.json()
  const parse = UpdateSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

  const tt = await prisma.tournamentTeam.findUnique({
    where:   { id: ttId },
    include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } } },
  })
  if (!tt) return jsonErr('Komanda nerasta', 404)

  const d = parse.data

  // Atnaujinti komandą
  await prisma.team.update({
    where: { id: tt.teamId },
    data: {
      ...(d.name    !== undefined && { name:    d.name ?? `${d.player1?.lastName ?? ''} / ${d.player2?.lastName ?? ''}` }),
      ...(d.club    !== undefined && { club:    d.club }),
      ...(d.rating  !== undefined && { rating:  d.rating }),
      ...(d.teamAge !== undefined && { teamAge: d.teamAge }),
    },
  })

  // Atnaujinti žaidėjus
  const players = tt.team.players
  if (d.player1 && players[0]) {
    await prisma.player.update({
      where: { id: players[0].id },
      data: {
        firstName:   d.player1.firstName,
        lastName:    d.player1.lastName,
        dateOfBirth: d.player1.dateOfBirth ? new Date(d.player1.dateOfBirth) : null,
        ageYears:    d.player1.ageYears ?? null,
        shirtSize:   d.player1.shirtSize ?? null,
      },
    })
  }
  if (d.player2 && players[1]) {
    await prisma.player.update({
      where: { id: players[1].id },
      data: {
        firstName:   d.player2.firstName,
        lastName:    d.player2.lastName,
        dateOfBirth: d.player2.dateOfBirth ? new Date(d.player2.dateOfBirth) : null,
        ageYears:    d.player2.ageYears ?? null,
        shirtSize:   d.player2.shirtSize ?? null,
      },
    })
  }

  // Atnaujinti seedRank ir seeded TournamentTeam lygiu
  const ttUpdate: any = {}
  if (d.seedRank !== undefined) ttUpdate.seedRank = d.seedRank
  if (d.seeded   !== undefined) ttUpdate.seeded   = d.seeded
  if (d.groupId !== undefined) ttUpdate.groupId = d.groupId
  if (Object.keys(ttUpdate).length > 0) {
    await prisma.tournamentTeam.update({ where: { id: ttId }, data: ttUpdate })
  }

  const updated = await prisma.tournamentTeam.findUnique({
    where:   { id: ttId },
    include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } }, group: true },
  })
  return jsonOk(updated)
})

export const DELETE = withAuth(async (_req: NextRequest, ctx: any) => {
  const ttId = getParam(ctx, 'ttId')
  const tt   = await prisma.tournamentTeam.findUnique({ where: { id: ttId } })
  if (!tt) return jsonErr('Komanda nerasta', 404)
  await prisma.tournamentTeam.delete({ where: { id: ttId } })
  return jsonOk({ deleted: ttId })
})
