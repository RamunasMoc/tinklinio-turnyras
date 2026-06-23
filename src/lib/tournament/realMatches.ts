type MatchForVisibility = {
  id: string
  groupId: string | null
  round: string | null
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  matchNumber: number | null
}

export function filterRealKnockoutMatches<T extends MatchForVisibility>(matches: T[]) {
  const hasWBFinal = matches.some(match => match.round === 'F')
  const hasLBFinal = matches.some(match => match.round === 'LB-F')
  const firstRound = matches.some(match => match.round === 'R16') ? 'R16' : 'QF'

  const loserSourceCount = (matchNumber: number | null) =>
    [(matchNumber ?? 1) * 2 - 1, (matchNumber ?? 1) * 2].filter(number => {
      const source = matches.find(match => match.round === firstRound && match.matchNumber === number)
      return source?.homeTeamId && source?.awayTeamId
    }).length

  return matches.filter(match => {
    // Automatinis perėjimas dėl laisvos vietos yra techninis įrašas, ne rungtynės.
    if (match.status === 'FINISHED' && (!match.homeTeamId || !match.awayTeamId)) return false
    if (match.round === 'LB-R1' && loserSourceCount(match.matchNumber) < 2) return false
    if (match.round === 'LB-R2' && loserSourceCount(match.matchNumber) === 0) return false
    if (!hasWBFinal && !hasLBFinal && match.round === 'LB-SF' && (match.matchNumber ?? 1) > 1) return false
    return true
  })
}

export function filterRealMatches<T extends MatchForVisibility>(matches: T[]) {
  const knockoutIds = new Set(
    filterRealKnockoutMatches(matches.filter(match => !match.groupId)).map(match => match.id),
  )
  return matches.filter(match => Boolean(match.groupId) || knockoutIds.has(match.id))
}
