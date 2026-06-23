import { filterRealMatches } from '../realMatches'

const match = (overrides: Partial<{
  id: string
  groupId: string | null
  round: string | null
  status: string
  homeTeamId: string | null
  awayTeamId: string | null
  matchNumber: number | null
}> = {}) => ({
  id: 'match',
  groupId: null,
  round: 'R16',
  status: 'SCHEDULED',
  homeTeamId: 'home',
  awayTeamId: 'away',
  matchNumber: 1,
  ...overrides,
})

describe('stebėtojui rodomos realios rungtynės', () => {
  test('paslepia baigtą techninį bye perėjimą', () => {
    const matches = [match({ status: 'FINISHED', awayTeamId: null })]
    expect(filterRealMatches(matches)).toHaveLength(0)
  })

  test('palieka normalias atkrintamųjų rungtynes', () => {
    const matches = [match({ status: 'FINISHED' })]
    expect(filterRealMatches(matches)).toHaveLength(1)
  })

  test('grupių rungtynės nėra paveikiamos', () => {
    const matches = [match({ groupId: 'group-a', round: null })]
    expect(filterRealMatches(matches)).toHaveLength(1)
  })

  test('paslepia neegzistuojantį pirmą pralaimėtojų etapą', () => {
    const matches = [
      match({ id: 'r16-1', matchNumber: 1, awayTeamId: null, status: 'FINISHED' }),
      match({ id: 'lb-1', round: 'LB-R1', matchNumber: 1, homeTeamId: 'team', awayTeamId: null }),
    ]
    expect(filterRealMatches(matches)).toHaveLength(0)
  })
})
