import { pointSystemInfo, qualificationInfo } from '../ruleLabels'

describe('viešai rodomos turnyro taisyklės', () => {
  test('fiksuoto režimo dalyvių skaičius apskaičiuojamas pagal grupes', () => {
    expect(qualificationInfo({ numGroups: 4, advancePerGroup: 3, advanceMode: 'fixed' })).toEqual({
      count: 12,
      explanation: 'Po 3 geriausias komandas iš kiekvienos grupės.',
    })
  })

  test('bendro limito režimas parodo tiesiogines ir papildomas vietas', () => {
    expect(qualificationInfo({ numGroups: 4, advancePerGroup: 3, advanceMode: 'total', advanceTotal: 14 })).toEqual({
      count: 14,
      explanation: 'Po 3 iš kiekvienos grupės patenka tiesiogiai, likusios vietos skiriamos geriausioms likusioms komandoms.',
    })
  })

  test('nemini papildomų vietų, kai bendras limitas lygus tiesioginėms vietoms', () => {
    expect(qualificationInfo({ numGroups: 4, advancePerGroup: 4, advanceMode: 'total', advanceTotal: 16 })).toEqual({
      count: 16,
      explanation: 'Po 4 geriausias komandas iš kiekvienos grupės.',
    })
  })

  test('setų santykio sistema paaiškinama laimėtų setų taškais', () => {
    expect(pointSystemInfo('SET_RATIO').explanation).toBe(
      'Komandos turnyriniai taškai yra lygūs jų laimėtų setų skaičiui.',
    )
  })
})
