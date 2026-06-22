export const ROUND_ORDER = [
  'R64', 'R32', 'R16', 'QF', 'LB-R1', 'LB-R2', 'SF', 'LB-R3', 'LB-R4',
  'LB-SF', 'F', 'LB-F', '3rd', 'GF', 'RR',
]

const ROUND_LABELS: Record<string, string> = {
  R64: '1/32', R32: '1/16', R16: '1/8', QF: 'Ketvirtfinaliai',
  SF: 'Pusfinaliai', F: 'Finalas', '3rd': 'Dėl 3 vietos',
  'LB-R1': 'Pralaimėtojų 1 etapas', 'LB-R2': 'Pralaimėtojų 2 etapas',
  'LB-R3': 'Pralaimėtojų 3 etapas', 'LB-R4': 'Pralaimėtojų 4 etapas',
  'LB-SF': 'Pralaimėtojų pusfinalis', 'LB-F': 'Pralaimėtojų finalas',
  GF: 'Grand finalas', RR: 'Finalinė grupė',
}

export function roundLabel(round: string | null | undefined) {
  return round ? (ROUND_LABELS[round] ?? round) : 'Atkrintamosios'
}

function safeRatio(won: number, lost: number) {
  if (lost === 0) return won === 0 ? 1 : Number.MAX_SAFE_INTEGER
  return won / lost
}

export function sortPublicGroupTeams(teams: any[], matches: any[]) {
  return [...teams].sort((a, b) => {
    if (b.groupPoints !== a.groupPoints) return b.groupPoints - a.groupPoints
    const tied = teams.filter(team => team.groupPoints === a.groupPoints)
    if (tied.length === 2) {
      const direct = matches.find(match => match.status === 'FINISHED' && (
        (match.homeTeamId === a.id && match.awayTeamId === b.id) ||
        (match.homeTeamId === b.id && match.awayTeamId === a.id)
      ))
      if (direct?.winnerId === a.id) return -1
      if (direct?.winnerId === b.id) return 1
    }
    if (b.groupWins !== a.groupWins) return b.groupWins - a.groupWins
    const setRatio = safeRatio(b.groupSetsWon, b.groupSetsLost) - safeRatio(a.groupSetsWon, a.groupSetsLost)
    if (Math.abs(setRatio) > 0.0001) return setRatio
    const pointRatio = safeRatio(b.groupPtsWon, b.groupPtsLost) - safeRatio(a.groupPtsWon, a.groupPtsLost)
    if (Math.abs(pointRatio) > 0.0001) return pointRatio
    return (b.groupPtsWon - b.groupPtsLost) - (a.groupPtsWon - a.groupPtsLost)
  })
}
