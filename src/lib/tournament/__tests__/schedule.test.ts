import { buildGroupSchedulePlan } from '../schedule'

describe('buildGroupSchedulePlan', () => {
  const start = 0
  const matchMs = 30 * 60 * 1000
  const breakMs = 0

  it('keeps each group on its own court when group and court counts match', () => {
    const plan = buildGroupSchedulePlan(
      [
        { id: 'A', teamIds: ['A1', 'A2', 'A3'] },
        { id: 'B', teamIds: ['B1', 'B2', 'B3'] },
        { id: 'C', teamIds: ['C1', 'C2', 'C3'] },
      ],
      3,
      start,
      matchMs,
      breakMs,
    )

    expect(new Set(plan.filter(match => match.groupId === 'A').map(match => match.court))).toEqual(new Set([1]))
    expect(new Set(plan.filter(match => match.groupId === 'B').map(match => match.court))).toEqual(new Set([2]))
    expect(new Set(plan.filter(match => match.groupId === 'C').map(match => match.court))).toEqual(new Set([3]))
  })

  it('uses a finished group court for another group when group sizes are uneven', () => {
    const plan = buildGroupSchedulePlan(
      [
        { id: 'A', teamIds: ['A1', 'A2'] },
        { id: 'B', teamIds: ['B1', 'B2', 'B3', 'B4'] },
      ],
      2,
      start,
      matchMs,
      breakMs,
    )

    const groupAMatches = plan.filter(match => match.groupId === 'A')
    const groupBMatches = plan.filter(match => match.groupId === 'B')

    expect(groupAMatches).toHaveLength(1)
    expect(groupAMatches[0].court).toBe(1)
    expect(groupBMatches.some(match => match.court === 1)).toBe(true)
    expect(groupBMatches[0].court).toBe(2)
  })
})
