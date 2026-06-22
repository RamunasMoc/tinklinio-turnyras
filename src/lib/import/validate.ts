// ============================================================
// src/lib/import/validate.ts
// Vienos komandos eilutės validacija
// ============================================================

import type { TeamInput, FieldError, Category } from './types'

const VALID_CATS: Category[] = ['M', 'W', 'X']
const CAT_ALIASES: Record<string, Category> = {
  m: 'M', vyrai: 'M', men: 'M', male: 'M',
  w: 'W', moterys: 'W', women: 'W', female: 'W',
  x: 'X', mix: 'X', mixed: 'X',
}

// ─── Kategorija ─────────────────────────────────────────────

export function parseCategory(raw: string | undefined | null): Category | null {
  const s = (raw ?? '').trim().toLowerCase()
  if (!s) return null
  if (VALID_CATS.includes(s.toUpperCase() as Category)) return s.toUpperCase() as Category
  return CAT_ALIASES[s] ?? null
}

// ─── Vardas / pavardė ───────────────────────────────────────

export function parseName(raw: string | undefined | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

// ─── Reitingas ──────────────────────────────────────────────

export function parseRating(raw: string | undefined | null): number | null {
  if (!raw?.trim()) return null
  const n = parseInt(raw.trim(), 10)
  return isNaN(n) || n < 0 ? null : n
}

// ─── Amžiaus grupė ──────────────────────────────────────────

const VALID_AGE_GROUPS = ['U18', 'U21', 'U23', 'OPEN', '40+', '50+']

export function parseAgeGroup(raw: string | undefined | null): string | null {
  const s = (raw ?? '').trim().toUpperCase()
  return VALID_AGE_GROUPS.includes(s) ? s : null
}

// ─── Pilna komandos validacija ──────────────────────────────

export function validateTeam(team: Partial<TeamInput>): FieldError[] {
  const errors: FieldError[] = []

  // Komandos pavadinimas
  if (!team.name?.trim()) {
    errors.push({ field: 'name', message: 'Komandos pavadinimas yra privalomas' })
  } else if (team.name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Pavadinimas per ilgas (maks. 100 simbolių)' })
  }

  // Kategorija
  if (!team.category) {
    errors.push({ field: 'category', message: 'Kategorija privaloma: M, W arba X' })
  }

  // 1 žaidėjas
  if (!team.player1?.firstName?.trim()) {
    errors.push({ field: 'player1.firstName', message: '1 žaidėjo vardas privalomas' })
  }
  if (!team.player1?.lastName?.trim()) {
    errors.push({ field: 'player1.lastName', message: '1 žaidėjo pavardė privaloma' })
  }

  // 2 žaidėjas
  if (!team.player2?.firstName?.trim()) {
    errors.push({ field: 'player2.firstName', message: '2 žaidėjo vardas privalomas' })
  }
  if (!team.player2?.lastName?.trim()) {
    errors.push({ field: 'player2.lastName', message: '2 žaidėjo pavardė privaloma' })
  }

  // Reitingas (jei nurodytas — teigiamas skaičius)
  if (team.rating !== null && team.rating !== undefined && team.rating < 0) {
    errors.push({ field: 'rating', message: 'Reitingas negali būti neigiamas' })
  }

  return errors
}
