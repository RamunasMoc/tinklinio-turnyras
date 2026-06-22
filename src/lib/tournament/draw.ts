// ============================================================
// src/lib/tournament/draw.ts
// Burtų traukimo metodai
// ============================================================

export type DrawTeam = {
  id:      string
  seeded:  boolean
  rating:  number | null
  clubId?: string | null
}

// ─── Pagrindinė funkcija ──────────────────────────────────────
// Grąžina: groupIndex[] (kuri grupė kiekvienai komandai)

export function drawTeams(
  teams:      DrawTeam[],
  numGroups:  number,
  method:     string,
  clubRule:   boolean,
): number[] {
  switch (method) {
    case 'SEEDED_RANDOM': return drawSeededRandom(teams, numGroups, clubRule)
    case 'SNAKE':         return drawSnake(teams, numGroups, clubRule)
    case 'MANUAL':        return drawRandom(teams, numGroups, clubRule) // Manual = kaip RANDOM, UI leis keisti
    default:              return drawRandom(teams, numGroups, clubRule)  // RANDOM
  }
}

// ─── RANDOM ───────────────────────────────────────────────────
// Sėjamosios tolygiai paskirstomos, likusios atsitiktinai
// Klubų taisyklė: tos pačios klubo komandos į skirtingas grupes

function drawRandom(teams: DrawTeam[], G: number, clubRule: boolean): number[] {
  const seeded    = teams.filter(t => t.seeded)
  const nonSeeded = shuffle(teams.filter(t => !t.seeded))

  const groups: string[][] = Array.from({ length: G }, () => [])

  // Sėjamosios tolygiai į grupes (po vieną į kiekvieną), taikant klubo taisyklę
  const shuffledSeeds = shuffle([...seeded])
  for (let i = 0; i < shuffledSeeds.length; i++) {
    placeSeededTeam(groups, G, shuffledSeeds[i], clubRule, teams, i % G)
  }

  // Likusios atsitiktinai su klubų taisykle
  for (const team of nonSeeded) {
    placeTeam(groups, G, team, clubRule, teams)
  }

  return assignmentToArray(teams, groups)
}

// ─── SEEDED_RANDOM ────────────────────────────────────────────
// Sėjamosios pagal reitingą (stipriausia į gr.A, ir t.t.)
// Likusios atsitiktinai

function drawSeededRandom(teams: DrawTeam[], G: number, clubRule: boolean): number[] {
  const seeded = [...teams.filter(t => t.seeded)]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  const nonSeeded = shuffle(teams.filter(t => !t.seeded))

  const groups: string[][] = Array.from({ length: G }, () => [])

  // Stipriausios sėjamosios į pirmąsias grupes, taikant klubo taisyklę
  for (let i = 0; i < seeded.length; i++) {
    placeSeededTeam(groups, G, seeded[i], clubRule, teams, i % G)
  }

  for (const team of nonSeeded) {
    placeTeam(groups, G, team, clubRule, teams)
  }

  return assignmentToArray(teams, groups)
}

// ─── SNAKE ────────────────────────────────────────────────────
// Gyvatėlė pagal reitingą: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A...
// Sėjamosios pirmiausia, tada likusios

function drawSnake(teams: DrawTeam[], G: number, clubRule: boolean): number[] {
  const sorted = [...teams].sort((a, b) => {
    // Sėjamosios pirmos, tada pagal reitingą
    if (a.seeded !== b.seeded) return a.seeded ? -1 : 1
    return (b.rating ?? 0) - (a.rating ?? 0)
  })

  const groups: string[][] = Array.from({ length: G }, () => [])
  let direction = 1
  let col       = 0

  for (const team of sorted) {
    // Patikrinti ar galima dėti į šią grupę (klubų taisyklė)
    let targetCol = col
    if (clubRule) {
      const avail = availableGroups(groups, G, team, clubRule, teams)
      if (!avail.includes(col)) {
        targetCol = avail[0] ?? col
      }
    }
    groups[targetCol].push(team.id)

    col += direction
    if (col >= G)  { col = G - 1;  direction = -1 }
    if (col < 0)   { col = 0;      direction =  1 }
  }

  return assignmentToArray(teams, groups)
}

// ─── Pagalbinės funkcijos ─────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function placeTeam(
  groups: string[][],
  G: number,
  team: DrawTeam,
  clubRule: boolean,
  allTeams: DrawTeam[],
  preferredGroup?: number,
) {
  const available = availableGroups(groups, G, team, clubRule, allTeams)
  const gi = preferredGroup !== undefined && available.includes(preferredGroup)
    ? preferredGroup
    : available[Math.floor(Math.random() * available.length)]
  groups[gi].push(team.id)
}

function placeSeededTeam(
  groups: string[][],
  G: number,
  team: DrawTeam,
  clubRule: boolean,
  allTeams: DrawTeam[],
  preferredGroup: number,
) {
  const seededIds = new Set(allTeams.filter(t => t.seeded).map(t => t.id))
  const seededCounts = groups.map(g => g.filter(id => seededIds.has(id)).length)
  const minSeeded = Math.min(...seededCounts)
  const seedBalanced = seededCounts
    .map((count, i) => ({ count, i }))
    .filter(({ count }) => count === minSeeded)
    .map(({ i }) => i)

  const clubAllowed = clubRule && team.clubId
    ? seedBalanced.filter(i => !groupHasClub(groups[i], team, allTeams))
    : seedBalanced
  const candidates = clubAllowed.length > 0 ? clubAllowed : seedBalanced

  const gi = candidates.includes(preferredGroup)
    ? preferredGroup
    : candidates[Math.floor(Math.random() * candidates.length)]
  groups[gi].push(team.id)
}

function groupHasClub(group: string[], team: DrawTeam, allTeams: DrawTeam[]): boolean {
  if (!team.clubId) return false
  return group.some(id => allTeams.some(t => t.id === id && t.clubId === team.clubId))
}

// Gauti galimas grupes atsižvelgiant į klubų taisyklę
function availableGroups(
  groups: string[][],
  G:      number,
  team:   DrawTeam,
  clubRule: boolean,
  allTeams: DrawTeam[],
): number[] {
  if (!clubRule || !team.clubId) {
    // Grąžinti mažiausiai pilnas grupes
    const minSize = Math.min(...groups.map(g => g.length))
    return groups
      .map((g, i) => ({ i, len: g.length }))
      .filter(({ len }) => len === minSize)
      .map(({ i }) => i)
  }

  // Su klubų taisykle: grupė negali turėti tos pačios klubo komandos
  const clubTeamIds = allTeams
    .filter(t => t.clubId === team.clubId && t.id !== team.id)
    .map(t => t.id)

  const available = groups
    .map((g, i) => ({ i, g }))
    .filter(({ g }) => !g.some(id => clubTeamIds.includes(id)))
    .map(({ i }) => i)

  // Jei nėra tinkamos grupės — ignoruoti klubų taisyklę
  if (available.length === 0) {
    return Array.from({ length: G }, (_, i) => i)
  }

  // Iš galimų — mažiausiai pilnos
  const minSize = Math.min(...available.map(i => groups[i].length))
  return available.filter(i => groups[i].length === minSize)
}

function assignmentToArray(teams: DrawTeam[], groups: string[][]): number[] {
  const map = new Map<string, number>()
  groups.forEach((g, gi) => g.forEach(id => map.set(id, gi)))
  return teams.map(t => map.get(t.id) ?? 0)
}
