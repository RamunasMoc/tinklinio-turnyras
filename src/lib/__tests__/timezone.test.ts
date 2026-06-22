import { combineDateAndTimeInZone, timeOnlyDate, timeOnlyString, timeStringInZone } from '../timezone'

describe('turnyro laikas Europe/Vilnius zonoje', () => {
  test('tik laiko reikšmė nepriklauso nuo serverio laiko zonos', () => {
    expect(timeOnlyDate('14:30').toISOString()).toBe('1970-01-01T14:30:00.000Z')
    expect(timeOnlyString('1970-01-01T14:30:00.000Z', '09:00')).toBe('14:30')
  })

  test('vasarą Vilniaus 14:00 paverčiama į 11:00 UTC', () => {
    const result = combineDateAndTimeInZone('2026-06-25T21:00:00.000Z', '14:00')
    expect(result.toISOString()).toBe('2026-06-26T11:00:00.000Z')
    expect(timeStringInZone(result, '')).toBe('14:00')
  })

  test('žiemą Vilniaus 14:00 paverčiama į 12:00 UTC', () => {
    const result = combineDateAndTimeInZone('2026-01-09T22:00:00.000Z', '14:00')
    expect(result.toISOString()).toBe('2026-01-10T12:00:00.000Z')
    expect(timeStringInZone(result, '')).toBe('14:00')
  })
})
