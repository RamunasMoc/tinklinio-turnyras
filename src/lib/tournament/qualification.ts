export function groupAdvanceCounts(
  config: { advancePerGroup?: number | null },
  groupCount: number,
  groupSizes?: Array<number | null | undefined>,
) {
  const perGroup = Math.max(0, Number(config.advancePerGroup ?? 2))

  return Array.from({ length: groupCount }, (_, index) => {
    const size = groupSizes?.[index]
    return typeof size === 'number' ? Math.min(perGroup, size) : perGroup
  })
}
