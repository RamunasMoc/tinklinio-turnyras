import { NextRequest }           from 'next/server'
import { prisma }                from '@/lib/prisma'
import { withAuth, jsonOk, jsonErr, getParam } from '@/lib/middleware/auth'
import { drawTeams }             from '@/lib/tournament/draw'

// POST /api/tournaments/[id]/groups/draw — pakartoti burtus (komandos lieka, tik perskirsčia)
export const POST = withAuth(async (_req: NextRequest, ctx: any) => {
  const tournamentId = getParam(ctx, 'id')

  const cfg = await prisma.tournamentConfig.findUnique({ where: { tournamentId } })
  if (!cfg) return jsonErr('Konfigūracija nerasta', 400)

  const groups = await prisma.group.findMany({
    where:   { tournamentId },
    orderBy: { order: 'asc' },
    include: { teams: { include: { team: true } } },
  })
  if (groups.length === 0) return jsonErr('Grupės dar nesuformuotos', 400)

  const teams = await prisma.tournamentTeam.findMany({
    where:   { tournamentId },
    include: { team: true },
    orderBy: { registeredAt: 'asc' },
  })

  const G = groups.length
  const drawInput = teams.map(tt => ({
    id:     tt.id,
    seeded: tt.seeded,
    rating: tt.team.rating,
    clubId: tt.team.club ?? null,
  }))

  const assignments = drawTeams(drawInput, G, cfg.drawMethod, cfg.clubRule)

  // Išvalyti setus ir mačus (bet ne grupes)
  await prisma.$transaction([
    prisma.set.deleteMany({ where: { match: { tournamentId, groupId: { not: null } } } }),
    prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } }),
    prisma.tournamentTeam.updateMany({
      where: { tournamentId },
      data:  { groupId: null, groupPoints: 0, groupWins: 0, groupLosses: 0,
               groupSetsWon: 0, groupSetsLost: 0, groupPtsWon: 0, groupPtsLost: 0 },
    }),
  ])

  // Priskirti komandas į grupes pagal naujus burtus
  for (let gi = 0; gi < G; gi++) {
    const groupTeams = teams.filter((_, i) => assignments[i] === gi)
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: groupTeams.map(t => t.id) } },
      data:  { groupId: groups[gi].id },
    })
  }

  const updated = await prisma.group.findMany({
    where:   { tournamentId },
    orderBy: { order: 'asc' },
    include: { teams: { include: { team: true } } },
  })

  return jsonOk(updated)
})
