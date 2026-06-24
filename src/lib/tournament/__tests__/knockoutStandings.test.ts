import { buildKnockoutStandings, type KnockoutStandingMatch } from '../knockoutStandings'

const teams = Array.from({ length: 8 }, (_, index) => ({
  id: `t${index + 1}`,
  name: `Komanda ${index + 1}`,
  seed: index + 1,
}))

function match(
  round: string,
  order: number,
  home: string,
  away: string,
  winner: string,
  score: [number, number] = [2, 0],
): KnockoutStandingMatch {
  const homeWins = winner === home
  return {
    round,
    matchOrder: order,
    status: 'FINISHED',
    homeTeamId: home,
    awayTeamId: away,
    winnerId: winner,
    sets: [
      { homeScore: homeWins ? 15 : 10, awayScore: homeWins ? 10 : 15, isTiebreak: false },
      { homeScore: homeWins ? 15 : 11, awayScore: homeWins ? 11 : 15, isTiebreak: false },
      ...(score[0] === 2 && score[1] === 1
        ? [{ homeScore: homeWins ? 11 : 8, awayScore: homeWins ? 8 : 11, isTiebreak: true }]
        : []),
    ],
  }
}

describe('atkrintamųjų galutinė rikiuotė', () => {
  test('vieno minuso sistemoje finalas ir rungtynės dėl trečios vietos nustato 1–4 vietas', () => {
    const matches = [
      match('QF', 1, 't1', 't8', 't1'), match('QF', 2, 't4', 't5', 't4'),
      match('QF', 3, 't2', 't7', 't2'), match('QF', 4, 't3', 't6', 't3'),
      match('SF', 5, 't1', 't4', 't1'), match('SF', 6, 't2', 't3', 't2'),
      match('3rd', 7, 't4', 't3', 't3'), match('F', 8, 't1', 't2', 't1'),
    ]
    const result = buildKnockoutStandings(teams, matches, 'SINGLE_ELIMINATION')
    expect(result.complete).toBe(true)
    expect(result.rows.slice(0, 4).map(row => [row.id, row.place])).toEqual([
      ['t1', '1'], ['t2', '2'], ['t3', '3'], ['t4', '4'],
    ])
    expect(result.rows.filter(row => row.place === '5–8')).toHaveLength(4)
  })

  test('be rungtynių dėl trečios vietos pusfinalių pralaimėtojai dalijasi 3–4 vietomis', () => {
    const result = buildKnockoutStandings(teams.slice(0, 4), [
      match('SF', 1, 't1', 't4', 't1'),
      match('SF', 2, 't2', 't3', 't2'),
      match('F', 3, 't1', 't2', 't1'),
    ], 'SINGLE_ELIMINATION')
    expect(result.rows.filter(row => row.place === '3–4').map(row => row.id).sort()).toEqual(['t3', 't4'])
  })

  test('dviejų minusų sistemoje čempioną nustato grand finalas', () => {
    const result = buildKnockoutStandings(teams.slice(0, 4), [
      match('QF', 1, 't1', 't4', 't1'), match('QF', 2, 't2', 't3', 't2'),
      match('LB-R1', 3, 't4', 't3', 't3'),
      match('F', 4, 't1', 't2', 't1'),
      match('LB-F', 5, 't2', 't3', 't2'),
      match('GF', 6, 't1', 't2', 't1'),
    ], 'DOUBLE_ELIMINATION')
    expect(result.complete).toBe(true)
    expect(result.rows[0]).toMatchObject({ id: 't1', place: '1', statusLabel: 'Čempionai' })
    expect(result.rows[1]).toMatchObject({ id: 't2', place: '2' })
    expect(result.rows.find(row => row.id === 't3')?.place).toBe('3')
  })

  test('apskritajame formate rikiuoja pagal pergales ir įtraukia tik perduotas komandas', () => {
    const result = buildKnockoutStandings(teams.slice(0, 3), [
      match('RR1', 1, 't1', 't2', 't1'),
      match('RR2', 2, 't1', 't3', 't1'),
      match('RR3', 3, 't2', 't3', 't2'),
      match('RR4', 4, 't4', 't5', 't4'),
    ], 'ROUND_ROBIN')
    expect(result.rows.map(row => row.id)).toEqual(['t1', 't2', 't3'])
    expect(result.rows.map(row => row.wins)).toEqual([2, 1, 0])
  })

  test('techninis perėjimas be dviejų komandų nėra skaičiuojamas kaip rungtynės', () => {
    const result = buildKnockoutStandings(teams.slice(0, 2), [{
      round: 'QF', status: 'FINISHED', homeTeamId: 't1', awayTeamId: null, winnerId: 't1', sets: [],
    }], 'SINGLE_ELIMINATION')
    expect(result.rows.every(row => row.played === 0)).toBe(true)
  })

  test('tarpinėje rikiuotėje iškritusių komandų vietos lieka žemiau dar kovojančių', () => {
    const result = buildKnockoutStandings(teams, [
      match('QF', 1, 't1', 't8', 't1'),
      match('QF', 2, 't2', 't7', 't2'),
      match('QF', 3, 't3', 't6', 't3'),
      match('QF', 4, 't4', 't5', 't4'),
    ], 'SINGLE_ELIMINATION')
    expect(result.complete).toBe(false)
    expect(result.rows.slice(0, 4).every(row => row.place === '—')).toBe(true)
    expect(result.rows.slice(4).every(row => row.place === '5–8')).toBe(true)
  })
})
