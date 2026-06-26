export const THREE_TWO_ONE_ZERO = 'THREE_TWO_ONE_ZERO'

export function isBestOfTwoSetFormat(format: string | null | undefined) {
  return format === 'BO2_15' || format === 'BO2_21'
}

export function groupMatchPoints(
  pointSystem: string | null | undefined,
  setsWon: number,
  setsLost: number,
  won: boolean,
) {
  if (pointSystem === 'SET_RATIO') return setsWon
  if (pointSystem === THREE_TWO_ONE_ZERO) {
    if (won) return setsLost === 0 ? 3 : 2
    return setsWon === 1 ? 1 : 0
  }
  if (pointSystem === 'TWO_ONE') return won ? 2 : 1
  return won ? 1 : 0
}
