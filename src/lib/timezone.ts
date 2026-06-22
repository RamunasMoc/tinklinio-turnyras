export const TOURNAMENT_TIME_ZONE = 'Europe/Vilnius'

function zonedParts(date: Date, timeZone = TOURNAMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value ?? 0)

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function zoneOffsetMs(date: Date, timeZone = TOURNAMENT_TIME_ZONE) {
  const parts = zonedParts(date, timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return zonedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function combineDateAndTimeInZone(
  baseDate: Date | string,
  time: string,
  timeZone = TOURNAMENT_TIME_ZONE,
) {
  const dateParts = zonedParts(new Date(baseDate), timeZone)
  const [hour, minute] = time.split(':').map(Number)
  const wallClockUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, 0, 0)

  let candidate = new Date(wallClockUtc)
  candidate = new Date(wallClockUtc - zoneOffsetMs(candidate, timeZone))
  candidate = new Date(wallClockUtc - zoneOffsetMs(candidate, timeZone))
  return candidate
}

export function timeOnlyDate(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0, 0))
}

export function timeOnlyString(value: Date | string | null | undefined, fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

export function timeStringInZone(
  value: Date | string | null | undefined,
  fallback: string,
  timeZone = TOURNAMENT_TIME_ZONE,
) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('lt-LT', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}
