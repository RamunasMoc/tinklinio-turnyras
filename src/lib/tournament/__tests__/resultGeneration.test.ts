import { normalizeKOWinnerMode, rankedHomeWinsFromSeeds } from '../resultGeneration'

describe('KO automatinio nugalėtojo režimas', () => {
  test('nežinoma reikšmė saugiai palieka dabartinį reitingo režimą', () => {
    expect(normalizeKOWinnerMode(undefined)).toBe('ranked')
    expect(normalizeKOWinnerMode('anything')).toBe('ranked')
  })

  test('atsitiktinis režimas atpažįstamas', () => {
    expect(normalizeKOWinnerMode('random')).toBe('random')
  })

  test('mažesnis sėjimo numeris laikomas aukštesniu reitingu', () => {
    expect(rankedHomeWinsFromSeeds(2, 7)).toBe(true)
    expect(rankedHomeWinsFromSeeds(8, 3)).toBe(false)
  })

  test('be aiškaus reitingo laimėtojas paliekamas atsitiktinumui', () => {
    expect(rankedHomeWinsFromSeeds(null, 3)).toBeUndefined()
    expect(rankedHomeWinsFromSeeds(4, 4)).toBeUndefined()
  })
})
