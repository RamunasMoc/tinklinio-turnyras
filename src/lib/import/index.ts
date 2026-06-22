// ============================================================
// src/lib/import/index.ts
// Viešas modulio įėjimo taškas
// ============================================================

export { parseImportText }              from './parsers'
export { parseCsvLine, parseTsvLine, parsePlainLine } from './parsers'
export { parseAge, resolveAgeYears, ageToPrismaFields, formatAgeDisplay } from './age'
export { parseCategory, validateTeam }  from './validate'
export { saveImportedTeams }            from './save'
export type {
  TeamInput, PlayerInput, AgeData, Category,
  ParsedRow, ParseOk, ParseError, FieldError,
  ParseSummary, ImportResult,
}                                       from './types'
