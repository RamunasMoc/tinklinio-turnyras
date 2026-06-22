// ============================================================
// src/lib/import/age.ts
// Gimimo datos ir amžiaus apdorojimas
// ============================================================

import type { AgeData } from './types'

const DOB_RE  = /^\d{4}-\d{2}-\d{2}$/          // 1995-03-12
const APPROX_RE = /^~(\d{1,3})$/                // ~27

// ─── Parseris ───────────────────────────────────────────────
// Priima: "1995-03-12", "~27", tuščią eilutę arba bet ką kitą.
// Grąžina AgeData objektą.

export function parseAge(raw: string | undefined | null): AgeData {
  const s = (raw ?? '').trim()

  if (!s) return { type: 'unknown' }

  if (DOB_RE.test(s)) {
    const d = new Date(s)
    if (isNaN(d.getTime())) return { type: 'unknown' }   // pvz. 2000-13-01
    return { type: 'dob', value: s }
  }

  const approxMatch = s.match(APPROX_RE)
  if (approxMatch) {
    const age = parseInt(approxMatch[1], 10)
    if (age >= 5 && age <= 100) return { type: 'approx', value: age }
  }

  // Bandyti suprasti paprastą skaičių be ~ (pvz. "27")
  const plain = parseInt(s, 10)
  if (!isNaN(plain) && plain >= 5 && plain <= 100) {
    return { type: 'approx', value: plain }
  }

  return { type: 'unknown' }
}

// ─── Amžius metais iš AgeData ───────────────────────────────

export function resolveAgeYears(age: AgeData): number | null {
  if (age.type === 'dob') {
    const bd  = new Date(age.value)
    const now = new Date()
    let a = now.getFullYear() - bd.getFullYear()
    const mDiff = now.getMonth() - bd.getMonth()
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < bd.getDate())) a--
    return a
  }
  if (age.type === 'approx') return age.value
  return null
}

// ─── Prisma-ready laukų pora ────────────────────────────────

export function ageToPrismaFields(age: AgeData): {
  dateOfBirth: Date | null
  ageYears:    number | null
} {
  if (age.type === 'dob') {
    return {
      dateOfBirth: new Date(age.value),
      ageYears:    null,
    }
  }
  if (age.type === 'approx') {
    return {
      dateOfBirth: null,
      ageYears:    age.value,
    }
  }
  return { dateOfBirth: null, ageYears: null }
}

// ─── Ekrano rodmuo ──────────────────────────────────────────

export function formatAgeDisplay(age: AgeData): string {
  if (age.type === 'dob') {
    const years = resolveAgeYears(age)
    return `${age.value} (${years} m.)`
  }
  if (age.type === 'approx') return `~${age.value} m.`
  return '—'
}
