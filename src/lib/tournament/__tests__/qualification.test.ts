import { groupAdvanceCounts } from '../qualification'

describe('groupAdvanceCounts', () => {
  it('uses advancePerGroup as the guaranteed count for every group', () => {
    expect(groupAdvanceCounts({ advancePerGroup: 4 }, 3, [5, 5, 5])).toEqual([4, 4, 4])
  })

  it('caps counts by group size when sizes are known', () => {
    expect(groupAdvanceCounts({ advancePerGroup: 4 }, 3, [5, 3, 2])).toEqual([4, 3, 2])
  })
})
