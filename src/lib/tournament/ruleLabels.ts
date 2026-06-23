const SET_FORMAT_LABELS: Record<string, string> = {
  BO2_21: 'Best of 2, setai iki 21',
  BO2_15: 'Best of 2, setai iki 15',
  ONE_21: '1 setas iki 21',
  ONE_15: '1 setas iki 15',
}

const KNOCKOUT_FORMAT_LABELS: Record<string, string> = {
  SINGLE_ELIMINATION: 'Vieno minuso sistema',
  LUCKY_LOSER: 'FIVB Lucky Loser sistema',
  DOUBLE_ELIMINATION: 'Dviejų minusų sistema',
  ROUND_ROBIN: 'Apskritasis formatas, visi su visais',
}

const POINT_SYSTEMS: Record<string, { label: string; explanation: string }> = {
  TWO_ONE: {
    label: '2 taškai už laimėjimą, 1 už pralaimėjimą',
    explanation: 'Kiekvienų rungtynių nugalėtoja gauna 2 turnyrinius taškus, pralaimėjusi komanda gauna 1.',
  },
  WIN_LOSS: {
    label: '1 taškas už laimėjimą, 0 už pralaimėjimą',
    explanation: 'Kiekvienų rungtynių nugalėtoja gauna 1 turnyrinį tašką, pralaimėjusi komanda taškų negauna.',
  },
  SET_RATIO: {
    label: 'Taškas už kiekvieną laimėtą setą',
    explanation: 'Komandos turnyriniai taškai yra lygūs jų laimėtų setų skaičiui.',
  },
}

export function setFormatLabel(format: string | null | undefined) {
  return SET_FORMAT_LABELS[format ?? ''] ?? 'Nenurodyta'
}

export function knockoutFormatLabel(format: string | null | undefined) {
  return KNOCKOUT_FORMAT_LABELS[format ?? ''] ?? 'Nenurodyta'
}

export function pointSystemInfo(system: string | null | undefined) {
  return POINT_SYSTEMS[system ?? ''] ?? {
    label: 'Nenurodyta',
    explanation: 'Taškų skaičiavimo sistema dar nenustatyta.',
  }
}

export function qualificationInfo(config: {
  advanceMode?: string | null
  advancePerGroup?: number | null
  advanceTotal?: number | null
  numGroups?: number | null
}) {
  const groups = Math.max(1, config.numGroups ?? 1)
  const perGroup = Math.max(1, config.advancePerGroup ?? 1)
  const direct = groups * perGroup

  if (config.advanceMode === 'total') {
    const total = Math.max(direct, config.advanceTotal ?? direct)
    if (total === direct) {
      return {
        count: total,
        explanation: `Po ${perGroup} geriausias komandas iš kiekvienos grupės.`,
      }
    }
    return {
      count: total,
      explanation: `Po ${perGroup} iš kiekvienos grupės patenka tiesiogiai, likusios vietos skiriamos geriausioms likusioms komandoms.`,
    }
  }

  return {
    count: direct,
    explanation: `Po ${perGroup} geriausias komandas iš kiekvienos grupės.`,
  }
}
