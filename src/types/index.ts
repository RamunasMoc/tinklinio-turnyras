// ============================================================
// src/types/index.ts
// Bendri TypeScript tipai visai aplikacijai
// ============================================================

export type { Category, AgeGroup, SetFormat, KnockoutFormat,
  PointSystem, TournamentStatus, MatchStatus, DrawMethod }
  from '@prisma/client'

// ─── API atsakymų vokeliai ────────────────────────────────────

export type ApiOk<T>  = { ok: true;  data: T }
export type ApiErr    = { ok: false; error: string; field?: string }
export type ApiResult<T> = ApiOk<T> | ApiErr

export function ok<T>(data: T): ApiOk<T>   { return { ok: true, data } }
export function err(error: string, field?: string): ApiErr {
  return { ok: false, error, ...(field ? { field } : {}) }
}

// ─── Turnyras ─────────────────────────────────────────────────

export type TournamentSummary = {
  id:         string
  name:       string
  location:   string | null
  startsAt:   Date
  category:   string
  status:     string
  teamCount:  number
  groupCount: number
}

// ─── Komanda ──────────────────────────────────────────────────

export type PlayerDto = {
  id:          string
  firstName:   string
  lastName:    string
  dateOfBirth: string | null   // ISO date string
  ageYears:    number | null
  playerOrder: number
  // computed
  ageDisplay:  string          // "28 m." arba "~25 m." arba "—"
}

export type TeamDto = {
  id:       string
  name:     string
  club:     string | null
  category: string | null
  rating:   number | null
  ageGroup: string | null
  players:  PlayerDto[]
  // tournament-specific
  seeded:   boolean
  seedRank: number | null
  groupId:  string | null
  groupName:string | null
}

// ─── Grupė ───────────────────────────────────────────────────

export type StandingRow = {
  tournamentTeamId: string
  teamName:         string
  clubName:         string | null
  position:         number
  played:           number
  wins:             number
  losses:           number
  points:           number
  setsWon:          number
  setsLost:         number
  setRatio:         number
  ptsWon:           number
  ptsLost:          number
  ptRatio:          number
  plusMinus:        number
}

export type GroupDto = {
  id:           string
  name:         string
  order:        number
  maxTeams:     number
  advanceCount: number
  teams:        TeamDto[]
  standings:    StandingRow[]
  matches:      MatchDto[]
}

// ─── Rungtynės ────────────────────────────────────────────────

export type SetDto = {
  setNumber: number
  homeScore: number
  awayScore: number
  isTiebreak: boolean
}

export type MatchDto = {
  id:          string
  round:       string | null   // null = grupių etapas
  groupId:     string | null
  groupName:   string | null
  matchNumber: number | null
  court:       number | null
  scheduledAt: string | null   // ISO datetime
  startedAt:   string | null
  finishedAt:  string | null
  status:      string
  homeTeam:    MatchTeamDto | null
  awayTeam:    MatchTeamDto | null
  homeSets:    number | null
  awaySets:    number | null
  winnerId:    string | null
  sets:        SetDto[]
}

export type MatchTeamDto = {
  tournamentTeamId: string
  teamId:           string
  name:             string
  club:             string | null
  seed:             number | null
}

// ─── Atkrintamosios ───────────────────────────────────────────

export type BracketRound = {
  name:    string           // "QF", "SF", "F", "LB-R1" ...
  label:   string           // "Ketvirtfinaliai"
  matches: MatchDto[]
}

export type BracketDto = {
  format:        string
  winnersBracket: BracketRound[]
  losersBracket:  BracketRound[]
  grandFinal:    MatchDto | null
}

// ─── Tvarkaraštis ─────────────────────────────────────────────

export type ScheduleSlot = {
  time:    string            // "09:00"
  court:   number
  match:   MatchDto
}

export type ScheduleDay = {
  date:  string              // "2025-08-02"
  slots: ScheduleSlot[]
}

// ─── Setų rezultato įvedimas ──────────────────────────────────

export type SetInput = {
  setNumber:  number
  homeScore:  number
  awayScore:  number
  isTiebreak: boolean
}

export type MatchResultInput = {
  sets:      SetInput[]
  startedAt?: string
}
