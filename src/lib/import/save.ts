// ============================================================
// src/lib/import/save.ts
// ParsedRow[] → duomenų bazė (su dublikatų aptikimu)
// ============================================================

import { prisma }            from '../prisma'
import type { ParseOk, ImportResult } from './types'
import { ageToPrismaFields } from './age'

type SaveOptions = {
  tournamentId: string
  rows:         ParseOk[]
  // Kaip elgtis su esamomis komandomis:
  // 'skip'   – praleisti dublikatus (numatyta)
  // 'update' – atnaujinti esamą komandą
  onDuplicate?: 'skip' | 'update'
}

// ─── Pagrindinė išsaugojimo funkcija ────────────────────────

export async function saveImportedTeams(opts: SaveOptions): Promise<ImportResult> {
  const { tournamentId, rows, onDuplicate = 'skip' } = opts
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  for (const row of rows) {
    try {
      await saveOneTeam(row, tournamentId, onDuplicate, result)
    } catch (err) {
      result.errors.push({
        name:   row.team.name,
        reason: err instanceof Error ? err.message : 'Nežinoma klaida',
      })
    }
  }

  return result
}

// ─── Vienos komandos išsaugojimas ───────────────────────────

async function saveOneTeam(
  row:          ParseOk,
  tournamentId: string,
  onDuplicate:  'skip' | 'update',
  result:       ImportResult,
): Promise<void> {
  const { team } = row

  // 1. Ieškoti esamos komandos pagal pavadinimą ir klubą
  const existing = await prisma.team.findFirst({
    where: {
      name: { equals: team.name, mode: 'insensitive' },
      ...(team.club ? { club: { equals: team.club, mode: 'insensitive' } } : {}),
    },
    include: { players: true },
  })

  let teamId: string

  if (existing) {
    if (onDuplicate === 'skip') {
      // Patikrinti ar jau užregistruota į šį turnyra
      const alreadyIn = await prisma.tournamentTeam.findUnique({
        where: { tournamentId_teamId: { tournamentId, teamId: existing.id } },
      })
      if (alreadyIn) {
        result.skipped++
        return
      }
      teamId = existing.id
    } else {
      // Atnaujinti komandos duomenis
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          club:     team.club,
          category: team.category,
          rating:   team.rating,
        },
      })
      // Atnaujinti žaidėjus
      await updatePlayers(existing.id, existing.players, team)
      teamId = existing.id
    }
  } else {
    // Sukurti naują komandą su žaidėjais
    const created = await prisma.team.create({
      data: {
        name:     team.name,
        club:     team.club,
        category: team.category,
        rating:   team.rating,
        players: {
          create: [
            buildPlayerData(team.player1, 1),
            buildPlayerData(team.player2, 2),
          ],
        },
      },
    })
    teamId = created.id
  }

  // 2. Užregistruoti komandą į turnyra (jei dar ne)
  await prisma.tournamentTeam.upsert({
    where:  { tournamentId_teamId: { tournamentId, teamId } },
    create: { tournamentId, teamId },
    update: {},
  })

  result.imported++
}

// ─── Žaidėjų atnaujinimas ───────────────────────────────────

async function updatePlayers(
  teamId:   string,
  existing: { id: string; playerOrder: number }[],
  team:     ParseOk['team'],
): Promise<void> {
  const players = [team.player1, team.player2]

  for (let i = 0; i < players.length; i++) {
    const order = i + 1
    const p     = players[i]
    const found = existing.find(e => e.playerOrder === order)

    if (found) {
      await prisma.player.update({
        where: { id: found.id },
        data:  buildPlayerData(p, order),
      })
    } else {
      await prisma.player.create({
        data: { teamId, ...buildPlayerData(p, order) },
      })
    }
  }
}

// ─── Žaidėjo duomenų kūrimas ────────────────────────────────

function buildPlayerData(
  p:     import('./types').PlayerInput,
  order: number,
) {
  const { dateOfBirth, ageYears } = ageToPrismaFields(p.age)
  return {
    firstName:   p.firstName,
    lastName:    p.lastName,
    dateOfBirth,
    ageYears,
    playerOrder: order,
  }
}
