export type KOWinnerMode = 'ranked' | 'random'

export function normalizeKOWinnerMode(value: unknown): KOWinnerMode {
  return value === 'random' ? 'random' : 'ranked'
}

export function rankedHomeWinsFromSeeds(
  homeSeed: number | null | undefined,
  awaySeed: number | null | undefined,
): boolean | undefined {
  if (homeSeed == null || awaySeed == null || homeSeed === awaySeed) return undefined
  return homeSeed < awaySeed
}
