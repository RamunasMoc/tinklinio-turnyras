import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { drawTeams } from '@/lib/tournament/draw'
import { getParam, requireAuth } from '@/lib/middleware/auth'

async function clearGroupMatches(tournamentId: string) {
  await prisma.$transaction([
    prisma.set.deleteMany({ where: { match: { tournamentId, groupId: { not: null } } } }),
    prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } }),
    prisma.tournamentTeam.updateMany({
      where: { tournamentId },
      data: {
        groupPoints: 0,
        groupWins: 0,
        groupLosses: 0,
        groupSetsWon: 0,
        groupSetsLost: 0,
        groupPtsWon: 0,
        groupPtsLost: 0,
      },
    }),
  ])
}

function advanceCounts(cfg: any, groupCount: number) {
  if ((cfg.advanceMode ?? 'fixed') === 'fixed') {
    return Array(groupCount).fill(cfg.advancePerGroup ?? 2)
  }
  const total = cfg.advanceTotal ?? 8
  const base = Math.floor(total / groupCount)
  const extra = total % groupCount
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))
}

async function generateGroups(tournamentId: string) {
  const cfg = await prisma.tournamentConfig.findUnique({ where: { tournamentId } })
  if (!cfg) return

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    include: { team: true },
    orderBy: { registeredAt: 'asc' },
  })
  if (teams.length === 0) return

  const groupCount = cfg.numGroups ?? 4
  const base = Math.floor(teams.length / groupCount)
  const extra = teams.length % groupCount
  const groupSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))
  const advCounts = advanceCounts(cfg, groupCount)
  const assignments = drawTeams(
    teams.map(tt => ({ id: tt.id, seeded: tt.seeded, rating: tt.team.rating, clubId: tt.team.club ?? null })),
    groupCount,
    cfg.drawMethod,
    cfg.clubRule,
  )

  await prisma.$transaction([
    prisma.set.deleteMany({ where: { match: { tournamentId, groupId: { not: null } } } }),
    prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } }),
    prisma.tournamentTeam.updateMany({
      where: { tournamentId },
      data: { groupId: null, groupPoints: 0, groupWins: 0, groupLosses: 0, groupSetsWon: 0, groupSetsLost: 0, groupPtsWon: 0, groupPtsLost: 0 },
    }),
    prisma.group.deleteMany({ where: { tournamentId } }),
  ])

  const names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let gi = 0; gi < groupCount; gi++) {
    const groupTeams = teams.filter((_, i) => assignments[i] === gi)
    const group = await prisma.group.create({
      data: {
        tournamentId,
        name: names[gi],
        order: gi,
        maxTeams: groupSizes[gi],
        advanceCount: advCounts[gi] ?? Math.floor(groupTeams.length / 2),
      },
    })
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: groupTeams.map(t => t.id) } },
      data: { groupId: group.id },
    })
  }
}

async function redrawGroups(tournamentId: string) {
  const cfg = await prisma.tournamentConfig.findUnique({ where: { tournamentId } })
  if (!cfg) return

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
  })
  if (groups.length === 0) {
    await generateGroups(tournamentId)
    return
  }

  const teams = await prisma.tournamentTeam.findMany({
    where: { tournamentId },
    include: { team: true },
    orderBy: { registeredAt: 'asc' },
  })
  const assignments = drawTeams(
    teams.map(tt => ({ id: tt.id, seeded: tt.seeded, rating: tt.team.rating, clubId: tt.team.club ?? null })),
    groups.length,
    cfg.drawMethod,
    cfg.clubRule,
  )

  await clearGroupMatches(tournamentId)
  await prisma.tournamentTeam.updateMany({ where: { tournamentId }, data: { groupId: null } })

  for (let gi = 0; gi < groups.length; gi++) {
    const groupTeams = teams.filter((_, i) => assignments[i] === gi)
    await prisma.tournamentTeam.updateMany({
      where: { id: { in: groupTeams.map(t => t.id) } },
      data: { groupId: groups[gi].id },
    })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  const session = await requireAuth(['ADMIN'])
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const tournamentId = getParam(ctx, 'id')
  const form = await req.formData()
  const action = String(form.get('action') ?? '')

  if (action === 'redraw') await redrawGroups(tournamentId)
  else await generateGroups(tournamentId)

  return NextResponse.redirect(new URL(`/tournament/${tournamentId}/groups`, req.url))
}
