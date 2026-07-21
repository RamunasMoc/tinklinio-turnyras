import { getQualifiedTeams, isCustom12DoubleElimMatches } from '@/lib/bracket'

function tt(id: string, name: string, points: number, wins: number) {
  return {
    id,
    team: { name },
    groupPoints: points,
    groupWins: wins,
    groupSetsWon: wins * 2,
    groupSetsLost: Math.max(0, 4 - wins),
    groupPtsWon: 100 + points,
    groupPtsLost: 90,
  }
}

describe('getQualifiedTeams', () => {
  it('respects per-group advanceCount when groups qualify different counts', () => {
    const groups = [
      {
        name: 'A',
        advanceCount: 2,
        teams: [
          tt('a1', 'A first', 8, 4),
          tt('a2', 'A second', 6, 3),
          tt('a3', 'A third', 5, 2),
        ],
        matches: [],
      },
      {
        name: 'B',
        advanceCount: 1,
        teams: [
          tt('b1', 'B first', 7, 3),
          tt('b2', 'B second', 6, 3),
        ],
        matches: [],
      },
      {
        name: 'C',
        advanceCount: 1,
        teams: [
          tt('c1', 'C first', 7, 3),
          tt('c2', 'C second', 6, 3),
        ],
        matches: [],
      },
    ]

    expect(getQualifiedTeams(groups).map(team => team.tournamentTeamId)).toEqual([
      'a1',
      'b1',
      'c1',
      'a2',
    ])
  })
})

describe('isCustom12DoubleElimMatches', () => {
  const rounds = (counts: Record<string, number>) =>
    Object.entries(counts).flatMap(([round, count]) =>
      Array.from({ length: count }, () => ({ round }))
    )

  it('recognizes only the 12-team custom double elimination shape', () => {
    expect(isCustom12DoubleElimMatches(rounds({
      R16: 4,
      QF: 4,
      SF: 2,
      'LB-R1': 4,
      'LB-R2': 2,
      'LB-R3': 2,
      'LB-R4': 2,
      '3rd': 1,
      GF: 1,
    }))).toBe(true)

    expect(isCustom12DoubleElimMatches(rounds({
      R16: 8,
      QF: 4,
      SF: 2,
      F: 1,
      'LB-R1': 4,
      'LB-R2': 4,
      'LB-R3': 2,
      'LB-R4': 2,
      'LB-SF': 1,
      'LB-F': 1,
      '3rd': 1,
      GF: 1,
    }))).toBe(false)
  })
})

describe('advanceWinner', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('puts each single-elimination semifinal loser into a fixed third-place slot', async () => {
    const update = jest.fn()
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'sf-1',
        tournamentId: 'tournament',
        round: 'SF',
        matchNumber: 1,
        homeTeamId: 'team-1',
        awayTeamId: 'team-4',
        winnerId: 'team-1',
        tournament: { config: { knockoutFormat: 'SINGLE_ELIMINATION' } },
      })
      .mockResolvedValueOnce({
        id: 'sf-2',
        tournamentId: 'tournament',
        round: 'SF',
        matchNumber: 2,
        homeTeamId: 'team-3',
        awayTeamId: 'team-2',
        winnerId: 'team-3',
        tournament: { config: { knockoutFormat: 'SINGLE_ELIMINATION' } },
      })

    jest.doMock('@/lib/prisma', () => ({
      prisma: {
        match: {
          findUnique,
          findFirst: jest.fn(({ where }) => {
            if (where.round === 'F') return Promise.resolve({ id: 'final', round: 'F', matchNumber: 1 })
            if (where.round === '3rd') return Promise.resolve({ id: 'third', round: '3rd', matchNumber: 1 })
            return Promise.resolve(null)
          }),
          count: jest.fn(({ where }) => Promise.resolve(where.round === 'SF' ? 2 : 1)),
          update,
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    }))

    const { advanceWinner } = await import('@/lib/bracket')
    await advanceWinner('sf-1')
    await advanceWinner('sf-2')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'third' },
      data: { homeTeamId: 'team-4' },
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'third' },
      data: { awayTeamId: 'team-2' },
    })
  })
})
