// ============================================================
// src/lib/import/parsers.ts
// CSV / TSV / paprastas tekstas → TeamInput[]
// ============================================================

import type { ParsedRow, ParseSummary, TeamInput, PlayerInput } from './types'
import { parseAge }                       from './age'
import { parseCategory, parseName, parseRating, parseAgeGroup } from './validate'
import { validateTeam }                   from './validate'

// ─── Pagrindinė funkcija ─────────────────────────────────────
// Automatiškai aptinka formatą ir grąžina ParseSummary.

export function parseImportText(raw: string): ParseSummary {
  const lines = raw
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim().length > 0)

  if (!lines.length) {
    return { total: 0, valid: 0, invalid: 0, rows: [] }
  }

  // Aptikti formatą pagal pirmą ne-header eilutę
  const format = detectFormat(lines)

  let rows: ParsedRow[]

  switch (format) {
    case 'tsv':       rows = lines.map((l, i) => parseTsvLine(l, i + 1));  break
    case 'plain':     rows = lines.map((l, i) => parsePlainLine(l, i + 1)); break
    case 'csv':
    default:          rows = lines.map((l, i) => parseCsvLine(l, i + 1));   break
  }

  // Praleisti header eilutes
  const filtered = rows.filter(r => !isHeaderRow(r))

  const valid   = filtered.filter(r =>  r.ok).length
  const invalid = filtered.filter(r => !r.ok).length

  return { total: filtered.length, valid, invalid, rows: filtered }
}

// ─── Formato aptikimas ───────────────────────────────────────

type Format = 'csv' | 'tsv' | 'plain'

function detectFormat(lines: string[]): Format {
  const sample = lines.find(l => !isHeaderString(l)) ?? lines[0]
  if (sample.includes('\t'))     return 'tsv'
  if (sample.includes('|'))      return 'plain'
  return 'csv'
}

function isHeaderString(line: string): boolean {
  const l = line.toLowerCase().replace(/\s/g, '')
  return l.startsWith('pavadinimas') || l.startsWith('name') || l.startsWith('komanda')
}

function isHeaderRow(row: ParsedRow): boolean {
  return isHeaderString(row.raw)
}

// ─── CSV parseris ────────────────────────────────────────────
//
// Laukai (pozicija, eilė tvarka):
//  0  Pavadinimas    (privalomas)
//  1  Klubas         (neprivalomas)
//  2  Kategorija     (privalomas: M/W/X)
//  3  Reitingas      (neprivalomas)
//  4  Amžiaus grupė  (neprivalomas: U18/U21/U23/Open/40+/50+)
//  5  Vardas1        (privalomas)
//  6  Pavardė1       (privalomas)
//  7  GimData1       (neprivalomas: YYYY-MM-DD arba ~amžius)
//  8  Vardas2        (privalomas)
//  9  Pavardė2       (privalomas)
//  10 GimData2       (neprivalomas)

export function parseCsvLine(line: string, lineNum: number): ParsedRow {
  const cols = splitCsvLine(line)
  // Priimti ir seną 12 stulpelių eksportą su tuščiu rezerviniu lauku prieš žaidėjus.
  if (cols.length === 12 && cols[5] === '') cols.splice(5, 1)
  return buildRow(cols, line, lineNum)
}

// ─── TSV parseris ────────────────────────────────────────────
// Tas pats laukų išdėstymas kaip CSV, bet su tabuliacija.

export function parseTsvLine(line: string, lineNum: number): ParsedRow {
  const cols = line.split('\t').map(c => c.trim())
  return buildRow(cols, line, lineNum)
}

// ─── Paprastas tekstas ───────────────────────────────────────
//
// Formatas: Vardas1 Pavardė1 / Vardas2 Pavardė2 | Pavadinimas | Kat | Reitingas
//
// Pavyzdžiai:
//   Jonas Jonaitis / Petras Petraitis | Smėlio vilkai | M | 850
//   Ona Onaitis (1995-03-12) / Laura Lauraitė (~27) | Bangų riteriai | W
//   Tomas Tomaitis / Linas Linaitis | Vasaros vėjas | X

export function parsePlainLine(line: string, lineNum: number): ParsedRow {
  const parts = line.split('|').map(p => p.trim())

  if (parts.length < 3) {
    return {
      ok: false, lineNum, raw: line,
      errors: [{ field: 'format', message: 'Reikia bent: Žaidėjai | Pavadinimas | Kategorija' }],
    }
  }

  const [playersPart, namePart, catPart, ratingPart, agPart] = parts

  // Žaidėjų dalis: "Jonas Jonaitis (dob) / Petras Petraitis (~27)"
  const playerSplit = playersPart.split('/')
  if (playerSplit.length < 2) {
    return {
      ok: false, lineNum, raw: line,
      errors: [{ field: 'players', message: 'Žaidėjai turi būti atskirti „/"' }],
    }
  }

  const p1 = parsePlainPlayer(playerSplit[0].trim())
  const p2 = parsePlainPlayer(playerSplit[1].trim())

  const cols = [
    namePart,
    '',                       // klubas – plain formate nenurodomas atskirai
    catPart,
    ratingPart ?? '',
    agPart ?? '',
    p1.firstName,
    p1.lastName,
    p1.rawAge,
    p2.firstName,
    p2.lastName,
    p2.rawAge,
  ]

  return buildRow(cols, line, lineNum)
}

// ─── Žaidėjo parse'inimas iš plain teksto ───────────────────
// "Jonas Jonaitis (1995-03-12)"  →  { firstName, lastName, rawAge }
// "Petras Petraitis (~27)"       →  { firstName, lastName, rawAge }
// "Ona Onaitis"                  →  { firstName, lastName, rawAge: '' }

function parsePlainPlayer(s: string): { firstName: string; lastName: string; rawAge: string } {
  const ageMatch = s.match(/\(([^)]+)\)/)
  const rawAge   = ageMatch ? ageMatch[1].trim() : ''
  const namePart = s.replace(/\([^)]+\)/, '').trim()
  const words    = namePart.split(/\s+/)

  return {
    firstName: words[0] ?? '',
    lastName:  words.slice(1).join(' ') || (words[0] ?? ''),
    rawAge,
  }
}

// ─── Bendras eilutės konstravimas ───────────────────────────

function buildRow(cols: string[], raw: string, lineNum: number): ParsedRow {
  const get = (i: number) => (cols[i] ?? '').trim()

  const player1: PlayerInput = {
    firstName: parseName(get(5)),
    lastName:  parseName(get(6)),
    age:       parseAge(get(7)),
  }

  const player2: PlayerInput = {
    firstName: parseName(get(8)),
    lastName:  parseName(get(9)),
    age:       parseAge(get(10)),
  }

  const team: Partial<TeamInput> = {
    name:     parseName(get(0)),
    club:     parseName(get(1)) || null,
    category: parseCategory(get(2)) ?? undefined,
    rating:   parseRating(get(3)),
    ageGroup: parseAgeGroup(get(4)),
    player1,
    player2,
  }

  const errors = validateTeam(team)

  if (errors.length > 0) {
    return { ok: false, lineNum, raw, errors }
  }

  return { ok: true, lineNum, raw, team: team as TeamInput }
}

// ─── CSV eilutės splitas (pagerbiant kabutes) ────────────────
// "Smėlio vilkai, „geriausieji"",Vilnius,M  →  3 laukai

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '"' || ch === '\u201C' || ch === '\u201E') {
      // Lietuviškos kabutės „ " arba standartinės "
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}
