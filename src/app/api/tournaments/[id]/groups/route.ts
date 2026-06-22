import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { drawTeams }             from '@/lib/tournament/draw'

// GET /api/tournaments/[id]/groups
export async function GET(_req: NextRequest, ctx: any) {
  const id     = getParam(ctx, 'id')
  const groups = await prisma.group.findMany({
    where:   { tournamentId: id },
    orderBy: { order: 'asc' },
    include: {
      teams: {
        orderBy: [{ groupPoints: 'desc' }, { groupSetsWon: 'desc' }],
        include: {
          team: {
            include: { players: { orderBy: { playerOrder: 'asc' } } },
          },
        },
      },
      matches: {
        where: { status: 'FINISHED' },
        select: { homeTeamId: true, awayTeamId: true, winnerId: true, status: true },
      },
    },
  })
  return jsonOk(groups)
}

// POST /api/tournaments/[id]/groups — generuoti grupes
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')
  const body         = await req.json()
  const { groupSizes, advanceCounts } = body

  if (!Array.isArray(groupSizes) || groupSizes.length === 0) {
    return jsonErr('Grupių dydžiai privalomi', 400)
  }

  // Gauti konfigūraciją
  const cfg = await prisma.tournamentConfig.findUnique({ where: { tournamentId } })
  if (!cfg) return jsonErr('Konfigūracija nerasta', 400)

  // Gauti komandas
  const teams = await prisma.tournamentTeam.findMany({
    where:   { tournamentId },
    include: { team: true },
    orderBy: { registeredAt: 'asc' },
  })

  if (teams.length === 0) return jsonErr('Nėra komandų', 400)

  const G = groupSizes.length

  // Burtų traukimas
  const drawInput = teams.map(tt => ({
    id:     tt.id,
    seeded: tt.seeded,
    rating: tt.team.rating,
    clubId: tt.team.club ?? null,
  }))

  const assignments = drawTeams(drawInput, G, cfg.drawMethod, cfg.clubRule)

  // Išvalyti senas grupes
  await prisma.$transaction([
    prisma.set.deleteMany({ where: { match: { tournamentId, groupId: { not: null } } } }),
    prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } }),
    prisma.tournamentTeam.updateMany({ where: { tournamentId }, data: { groupId: null, groupPoints: 0, groupWins: 0, groupLosses: 0, groupSetsWon: 0, groupSetsLost: 0, groupPtsWon: 0, groupPtsLost: 0 } }),
    prisma.group.deleteMany({ where: { tournamentId } }),
  ])

  // Sukurti naujas grupes
  const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const createdGroups = []

  for (let gi = 0; gi < G; gi++) {
    const groupTeams = teams.filter((_, i) => assignments[i] === gi)
    const advCount   = advanceCounts?.[gi] ?? Math.floor(groupTeams.length / 2)

    const group = await prisma.group.create({
      data: {
        tournamentId,
        name:         groupNames[gi],
        order:        gi,
        maxTeams:     groupSizes[gi],
        advanceCount: advCount,
      },
    })

    // Priskirti komandas
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: groupTeams.map(t => t.id) } },
      data:  { groupId: group.id },
    })

    const updated = await prisma.group.findUnique({
      where:   { id: group.id },
      include: { teams: { include: { team: true } } },
    })
    createdGroups.push(updated)
  }

  return jsonOk(createdGroups)
})
