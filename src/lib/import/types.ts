// ============================================================
// src/lib/import/types.ts
// ============================================================

export type Category = 'M' | 'W' | 'X'

export type AgeData =
  | { type: 'dob';     value: string }   // "1995-03-12"
  | { type: 'approx';  value: number }   // ~27
  | { type: 'unknown'                }

export type PlayerInput = {
  firstName: string
  lastName:  string
  age:       AgeData
}

export type TeamInput = {
  name:     string
  club:     string | null
  category: Category
  rating:   number | null
  ageGroup: string | null
  player1:  PlayerInput
  player2:  PlayerInput
}

// ─── Parse result per row ───────────────────────────────────

export type ParseOk = {
  ok:       true
  lineNum:  number
  raw:      string
  team:     TeamInput
}

export type ParseError = {
  ok:       false
  lineNum:  number
  raw:      string
  errors:   FieldError[]
}

export type FieldError = {
  field:   string
  message: string
}

export type ParsedRow = ParseOk | ParseError

// ─── Summary after full parse ───────────────────────────────

export type ParseSummary = {
  total:   number
  valid:   number
  invalid: number
  rows:    ParsedRow[]
}

// ─── DB save result ─────────────────────────────────────────

export type ImportResult = {
  imported:   number
  skipped:    number            // duplicates
  errors:     { name: string; reason: string }[]
}
