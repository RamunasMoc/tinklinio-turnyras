// ============================================================
// src/app/api/tournaments/[id]/teams/route.ts
// GET  — komandų sąrašas su žaidėjais
// POST — registruoti komandą (rankiniu būdu)
// ============================================================

import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { ageToPrismaFields }     from '@/lib/import/age'
import { parseAge }              from '@/lib/import/age'
import type { PlayerDto, TeamDto } from '@/types'
import { z }                     from 'zod'

const PlayerSchema = z.object({
  firstName:   z.string().min(1).max(60),
  lastName:    z.string().min(1).max(60),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ageYears:    z.number().int().min(5).max(100).optional().nullable(),
  shirtSize:   z.enum(['XS','S','M','L','XL','XXL']).optional().nullable(),
})

const TeamSchema = z.object({
  name:     z.string().max(100).optional(),
  club:     z.string().max(100).optional().nullable(),
  category: z.enum(['M','W','X']),
  rating:   z.number().int().min(0).optional().nullable(),
  teamAge:  z.number().int().min(0).optional().nullable(),
  ageGroup: z.string().optional().nullable(),
  player1:  PlayerSchema,
  player2:  PlayerSchema,
})

export const GET = withAuth(async (_req: NextRequest, ctx: any) => {
  const id    = getParam(ctx, 'id')
  const teams = await prisma.tournamentTeam.findMany({
    where:   { tournamentId: id },
    include: { team: { include: { players: { orderBy: { playerOrder: 'asc' } } } },
               group: true },
    orderBy: [{ seeded: 'desc' }, { seedRank: 'asc' }, { registeredAt: 'asc' }],
  })

  const dto: TeamDto[] = teams.map(tt => ({
    id:        tt.team.id,
    name:      tt.team.name,
    club:      tt.team.club,
    category:  tt.team.category,
    rating:    tt.team.rating,
    ageGroup:  null,
    players:   tt.team.players.map(p => playerDto(p)),
    seeded:    tt.seeded,
    seedRank:  tt.seedRank,
    groupId:   tt.groupId,
    groupName: tt.group?.name ?? null,
  }))

  return jsonOk(dto)
}, ['ADMIN'])

export const POST = withAuth(async (req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')
  const body  = await req.json()
  const parse = TeamSchema.safeParse(body)
  if (!parse.success) return jsonErr(parse.error.issues[0].message, 400)

  const d = parse.data
  const autoName = d.name?.trim() ||
    `${d.player1.lastName} / ${d.player2.lastName}`

  const team = await prisma.team.create({
    data: {
      name:     autoName,
      club:     d.club,
      category: d.category,
      rating:   d.rating,
      teamAge:  d.teamAge,
      players:  {
        create: [
          buildPlayer(d.player1, 1),
          buildPlayer(d.player2, 2),
        ],
      },
    },
    include: { players: true },
  })

  const tt = await prisma.tournamentTeam.create({
    data: { tournamentId, teamId: team.id },
  })

  return jsonOk({ ...tt, team }, 201)
})

function buildPlayer(p: z.infer<typeof PlayerSchema>, order: number) {
  const age = p.dateOfBirth
    ? parseAge(p.dateOfBirth)
    : p.ageYears
      ? { type: 'approx' as const, value: p.ageYears }
      : { type: 'unknown' as const }
  const { dateOfBirth, ageYears } = ageToPrismaFields(age)
  return { firstName: p.firstName, lastName: p.lastName,
           dateOfBirth, ageYears, shirtSize: p.shirtSize ?? null, playerOrder: order }
}

function playerDto(p: any): PlayerDto {
  let ageDisplay = '—'
  if (p.dateOfBirth) {
    const bd = new Date(p.dateOfBirth), now = new Date()
    let a = now.getFullYear() - bd.getFullYear()
    if (now.getMonth() - bd.getMonth() < 0) a--
    ageDisplay = `${a} m.`
  } else if (p.ageYears) {
    ageDisplay = `~${p.ageYears} m.`
  }
  return { id: p.id, firstName: p.firstName, lastName: p.lastName,
           dateOfBirth: p.dateOfBirth?.toISOString().slice(0,10) ?? null,
           ageYears: p.ageYears, playerOrder: p.playerOrder, ageDisplay }
}
