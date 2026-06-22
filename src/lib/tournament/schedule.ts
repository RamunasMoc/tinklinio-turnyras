import { prisma } from '../prisma'
import { combineDateAndTimeInZone, timeOnlyString } from '../timezone'

export async function generateGroupSchedule(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      config: true,
      groups: { include: { teams: true }, orderBy: { order: 'asc' } },
    },
  })
  if (!tournament?.config) throw new Error('Nėra konfigūracijos')

  const cfg     = tournament.config
  const matchMs = cfg.groupTimeMinutes * 60 * 1000
  const breakMs = cfg.groupBreakMinutes * 60 * 1000
  const courts  = cfg.groupCourts
  // Naudoti groupStartsAt jei nustatytas, kitaip tournament.startsAt
  const startDate = cfg.groupStartsAt
    ? combineDateAndTimeInZone(
        tournament.startsAt,
        timeOnlyString(cfg.groupStartsAt, '09:00'),
      )
    : tournament.startsAt
  const start = startDate.getTime()

  await prisma.match.deleteMany({ where: { tournamentId, groupId: { not: null } } })

  // Sudaryti visas poras naudojant Berger lentelę
  // Berger garantuoja, kad viename raunde kiekviena komanda žaidžia tik VIENĄ kartą
  type Pair = { groupId: string; homeId: string; awayId: string; round: number }
  const pairs: Pair[] = []

  for (const group of tournament.groups) {
    const ids    = group.teams.map(t => t.id)
    const rounds = bergerRounds(ids)
    rounds.forEach((round, ri) => {
      for (const [a, b] of round) {
        pairs.push({ groupId: group.id, homeId: a, awayId: b, round: ri })
      }
    })
  }

  // Rikiuoti poras: pirmiausia skirtingų grupių pirmieji turai
  // Tai leidžia lygiagrečiai žaisti skirtingų grupių rungtynes
  pairs.sort((a, b) => a.round - b.round)

  // Aikštelių ir komandų užimtumo sekimas (ms)
  const courtFree: number[] = Array(courts).fill(start)
  const teamFree:  Record<string, number> = {}
  for (const g of tournament.groups)
    for (const t of g.teams)
      teamFree[t.id] = start

  let matchNum = 1

  for (const pair of pairs) {
    // Anksčiausias laikas kai abi komandos laisvos
    const teamReady = Math.max(
      teamFree[pair.homeId] ?? start,
      teamFree[pair.awayId] ?? start
    )

    // Rasti geriausią aikštelę: atsilaisvins anksčiausiai + abi komandos laisvos
    let bestCourt = 0
    let bestStart = Math.max(courtFree[0], teamReady)

    for (let i = 1; i < courts; i++) {
      const s = Math.max(courtFree[i], teamReady)
      if (s < bestStart) { bestStart = s; bestCourt = i }
    }

    const endsAt = bestStart + matchMs
    courtFree[bestCourt]   = endsAt + breakMs
    teamFree[pair.homeId]  = endsAt + breakMs
    teamFree[pair.awayId]  = endsAt + breakMs

    await prisma.match.create({
      data: {
        tournamentId,
        groupId:    pair.groupId,
        homeTeamId: pair.homeId,
        awayTeamId: pair.awayId,
        court:      bestCourt + 1,
        scheduledAt: new Date(bestStart),
        matchNumber: matchNum++,
      },
    })
  }
}

// ─── Berger lentelė ──────────────────────────────────────────
// Kiekvienas raundas garantuoja, kad komanda žaidžia tik vieną kartą.
// Jei nelyginis skaičius — viena komanda turi "bye" (praleidžia turą).

function bergerRounds(ids: string[]): [string, string][][] {
  const n    = ids.length % 2 === 0 ? ids.length : ids.length + 1
  const list = [...ids]
  if (list.length < n) list.push('__bye__')

  const rounds: [string, string][][] = []

  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]
      const b = list[n - 1 - i]
      if (a !== '__bye__' && b !== '__bye__') {
        round.push([a, b])
      }
    }
    rounds.push(round)

    // Rotacija: pirmasis fiksuotas, likusieji sukasi pagal laikrodžio rodyklę
    const last = list[n - 1]
    for (let i = n - 1; i > 1; i--) list[i] = list[i - 1]
    list[1] = last
  }

  return rounds
}
