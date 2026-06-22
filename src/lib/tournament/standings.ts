import { prisma } from '../prisma'

export async function recalcGroupStandings(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      tournament: { include: { config: true } },
      teams:      true,
      matches:    { where: { status: 'FINISHED' }, include: { sets: true } },
    },
  })
  if (!group) return

  const pointSystem = group.tournament.config?.groupPointSystem ?? 'TWO_ONE'
  const stats: Record<string, {
    wins:number; losses:number; points:number;
    setsWon:number; setsLost:number; ptsWon:number; ptsLost:number
  }> = {}

  for (const tt of group.teams) {
    stats[tt.id] = { wins:0, losses:0, points:0, setsWon:0, setsLost:0, ptsWon:0, ptsLost:0 }
  }

  for (const match of group.matches) {
    const { homeTeamId: hId, awayTeamId: aId, homeSets: hS, awaySets: aS } = match
    if (!hId || !aId || hS === null || aS === null) continue
    const h = stats[hId], a = stats[aId]
    if (!h || !a) continue

    for (const s of (match.sets as any[]).filter((s: any) => !s.isTiebreak)) {
      h.ptsWon  += s.homeScore; h.ptsLost += s.awayScore
      a.ptsWon  += s.awayScore; a.ptsLost += s.homeScore
    }
    // Setų statistikai skaičiuojame VISUS setus (įskaitant tiebreak)
    // kad lentelėje matytųsi tikras setų skaičius (pvz. 2:1, ne 1:1)
    const allSets = match.sets as any[]
    const hSetsAll = allSets.filter((s:any) => s.homeScore > s.awayScore).length
    const aSetsAll = allSets.filter((s:any) => s.awayScore > s.homeScore).length
    h.setsWon += hSetsAll; h.setsLost += aSetsAll
    a.setsWon += aSetsAll; a.setsLost += hSetsAll

    const winnerId = match.winnerId ?? winnerFromSets(match.sets as any[], hId, aId)
    if (!winnerId) continue
    const hw = winnerId === hId
    h.wins    += hw ? 1 : 0;  h.losses += hw ? 0 : 1
    a.wins    += hw ? 0 : 1;  a.losses += hw ? 1 : 0

    if (pointSystem === 'SET_RATIO') {
      h.points += hSetsAll
      a.points += aSetsAll
    } else if (pointSystem === 'TWO_ONE') {
      h.points += hw ? 2 : 1;  a.points += hw ? 1 : 2
    } else {
      h.points += hw ? 1 : 0;  a.points += hw ? 0 : 1
    }
  }

  for (const [id, s] of Object.entries(stats)) {
    await prisma.tournamentTeam.update({
      where: { id },
      data:  {
        groupWins:     s.wins,    groupLosses:   s.losses,  groupPoints: s.points,
        groupSetsWon:  s.setsWon, groupSetsLost: s.setsLost,
        groupPtsWon:   s.ptsWon,  groupPtsLost:  s.ptsLost,
      },
    })
  }
}

export function winnerFromSets(
  sets: { homeScore:number; awayScore:number; isTiebreak:boolean }[],
  homeTeamId: string | null,
  awayTeamId: string | null,
) {
  if (!homeTeamId || !awayTeamId) return null

  const mainSets = sets.filter(s => !s.isTiebreak)
  const homeSets = mainSets.filter(s => s.homeScore > s.awayScore).length
  const awaySets = mainSets.filter(s => s.awayScore > s.homeScore).length

  if (homeSets > awaySets) return homeTeamId
  if (awaySets > homeSets) return awayTeamId

  const tbSet = sets.find(s => s.isTiebreak)
  if (!tbSet || tbSet.homeScore === tbSet.awayScore) return null
  return tbSet.homeScore > tbSet.awayScore ? homeTeamId : awayTeamId
}
