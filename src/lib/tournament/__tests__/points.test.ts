import { groupMatchPoints, THREE_TWO_ONE_ZERO } from '../points'

describe('groupMatchPoints', () => {
  it('scores 3/2/1/0 matches by set result', () => {
    expect(groupMatchPoints(THREE_TWO_ONE_ZERO, 2, 0, true)).toBe(3)
    expect(groupMatchPoints(THREE_TWO_ONE_ZERO, 2, 1, true)).toBe(2)
    expect(groupMatchPoints(THREE_TWO_ONE_ZERO, 1, 2, false)).toBe(1)
    expect(groupMatchPoints(THREE_TWO_ONE_ZERO, 0, 2, false)).toBe(0)
  })

  it('keeps existing 2/1 and 1/0 behavior', () => {
    expect(groupMatchPoints('TWO_ONE', 2, 0, true)).toBe(2)
    expect(groupMatchPoints('TWO_ONE', 0, 2, false)).toBe(1)
    expect(groupMatchPoints('WIN_LOSS', 2, 0, true)).toBe(1)
    expect(groupMatchPoints('WIN_LOSS', 0, 2, false)).toBe(0)
  })
})
