// ============================================================
// prisma/seed.ts
// Pradiniai duomenys: admin vartotojas + demo turnyras
// Paleisti: npx ts-node prisma/seed.ts
// ============================================================

import { PrismaClient } from '@prisma/client'
import { hash }         from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Sėjame duomenis...')

  // ── Vartotojai ───────────────────────────────────────────
  const adminHash = await hash('admin123', 12)
  const refHash   = await hash('referee123', 12)

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@turnyras.lt' },
    update: {},
    create: { email: 'admin@turnyras.lt', name: 'Administratorius',
               passwordHash: adminHash, role: 'ADMIN' },
  })
  const ref = await prisma.user.upsert({
    where:  { email: 'teisejas@turnyras.lt' },
    update: {},
    create: { email: 'teisejas@turnyras.lt', name: 'Teisėjas 1',
               passwordHash: refHash, role: 'REFEREE' },
  })
  console.log(`✓ Vartotojai: ${admin.email}, ${ref.email}`)

  // ── Demo turnyras ────────────────────────────────────────
  const tournament = await prisma.tournament.upsert({
    where:  { id: 'demo-turnyras-2025' },
    update: {},
    create: {
      id:        'demo-turnyras-2025',
      name:      'Palangos paplūdimio tinklinis 2025',
      organizer: 'Palangos sporto centras',
      location:  'Palanga, Basanavičiaus g. 5',
      startsAt:  new Date('2025-08-02T09:00:00'),
      category:  'M',
      status:    'DRAFT',
    },
  })
  console.log(`✓ Turnyras: ${tournament.name}`)

  // ── Demo konfigūracija ───────────────────────────────────
  await prisma.tournamentConfig.upsert({
    where:  { tournamentId: tournament.id },
    update: {},
    create: {
      tournamentId:           tournament.id,
      numGroups:              4,
      groupSetFormat:         'BO2_21',
      groupTiebreakPoints:    15,
      groupTimeMinutes:       45,
      groupCourts:            4,
      groupPointSystem:       'TWO_ONE',
      groupBreakMinutes:      10,
      drawMethod:             'SEEDED_RANDOM',
      numSeeds:               4,
      clubRule:               true,
      knockoutFormat:         'SINGLE_ELIMINATION',
      knockoutSetFormat:      'BO2_21',
      knockoutTiebreakPoints: 15,
      finalSetFormat:         'BO2_21',
      knockoutTimeMinutes:    60,
      knockoutCourts:         2,
      thirdPlaceMatch:        true,
      knockoutStartsAt:       new Date('2025-08-02T15:00:00'),
      lunchBreakMinutes:      45,
    },
  })

  // ── Demo komandos (16) ───────────────────────────────────
  const TEAMS = [
    { name: 'Smėlio vilkai',    club: 'Vilnius BC',   rating: 910, p1: ['Jonas',   'Jonaitis',   '1995-03-12'], p2: ['Petras',  'Petraitis',  '1998-07-24'] },
    { name: 'Bangų riteriai',   club: 'Kaunas SC',    rating: 880, p1: ['Darius',  'Dariuitis',  '1993-05-20'], p2: ['Mantas',  'Mantaitis',  '1996-08-11'] },
    { name: 'Jūros vilkai',     club: 'Klaipėda BC',  rating: 850, p1: ['Tomas',   'Tomaitis',   '1997-01-15'], p2: ['Linas',   'Linaitis',   '2000-03-22'] },
    { name: 'Vasaros vėjas',    club: 'Palanga SC',   rating: 820, p1: ['Rytis',   'Ryčio',      '1994-09-01'], p2: ['Aurimas', 'Aurimaitis', '1999-11-30'] },
    { name: 'Kopos ir k.',      club: 'Vilnius BC',   rating: 800, p1: ['Mindaugas','Mindaugaitis','1992-06-18'], p2: ['Rokas',   'Rokiatis',   '2001-02-14'] },
    { name: 'Paplūdimio f.',    club: 'Kaunas SC',    rating: 780, p1: ['Gintaras','Gintaraitis', '1990-12-05'], p2: ['Saulius', 'Sauliaitis', '1995-07-19'] },
    { name: 'Saulės komanda',   club: 'Šiauliai VC',  rating: 760, p1: ['Erikas',  'Erikaitis',  '1996-04-23'], p2: ['Justas',  'Justaitis',  '1998-10-08'] },
    { name: 'Ryto banga',       club: 'Klaipėda BC',  rating: 740, p1: ['Vilius',  'Viliaitis',  '2000-08-17'], p2: ['Karolis', 'Karolaitis', '1997-05-31'] },
    { name: 'Vakarų vėjas',     club: 'Palanga SC',   rating: 720, p1: ['Nerijus', 'Nerijaitis', '1993-02-28'], p2: ['Ignas',   'Ignaitis',   '2002-06-12'] },
    { name: 'Smėlio audra',     club: 'Vilnius BC',   rating: 700, p1: ['Lukas',   'Lukaitis',   '1999-09-14'], p2: ['Matas',   'Mataitis',   '2001-11-25'] },
    { name: 'Mėlynoji banga',   club: 'Kaunas SC',    rating: 680, p1: ['Arnas',   'Arnaitis',   '1995-07-07'], p2: ['Emilis',  'Emiliaitis', '1998-03-19'] },
    { name: 'Pietų vėjas',      club: 'Šiauliai VC',  rating: 660, p1: ['Dominykas','Dominykaitis','1997-12-03'], p2: ['Benas',  'Benaitis',   '2000-05-28'] },
    { name: 'Pakrantės dr.',    club: 'Klaipėda BC',  rating: 640, p1: ['Tautvydas','Tautvydaitis','1991-08-21'], p2: ['Povilas','Povylaitis', '1994-01-16'] },
    { name: 'Smėlio žvaig.',    club: 'Palanga SC',   rating: 620, p1: ['Kęstutis','Kęstutaitis', '1996-10-09'], p2: ['Žygimantas','Žygimantaitis','1999-04-30'] },
    { name: 'Rytų banga',       club: 'Vilnius BC',   rating: 600, p1: ['Deividas','Deivydaitis', '2001-07-15'], p2: ['Kasparas','Kasparaitis','1998-02-23'] },
    { name: 'Saulėlydis',       club: 'Kaunas SC',    rating: 580, p1: ['Rimvydas','Rimvydaitis', '1993-11-07'], p2: ['Andrius', 'Andriaitis', '1996-06-14'] },
  ]

  for (let i = 0; i < TEAMS.length; i++) {
    const td = TEAMS[i]
    const dob = (s: string) => new Date(s)

    const team = await prisma.team.upsert({
      where:  { id: `demo-team-${i+1}` },
      update: {},
      create: {
        id:       `demo-team-${i+1}`,
        name:     td.name,
        club:     td.club,
        category: 'M',
        rating:   td.rating,
        players:  {
          create: [
            { firstName: td.p1[0], lastName: td.p1[1], dateOfBirth: dob(td.p1[2]), playerOrder: 1 },
            { firstName: td.p2[0], lastName: td.p2[1], dateOfBirth: dob(td.p2[2]), playerOrder: 2 },
          ],
        },
      },
    })

    await prisma.tournamentTeam.upsert({
      where:  { tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id } },
      update: {},
      create: {
        tournamentId: tournament.id,
        teamId:       team.id,
        seeded:       i < 4,
        seedRank:     i < 4 ? i + 1 : null,
      },
    })
  }
  console.log(`✓ Komandos: ${TEAMS.length} įkelta`)

  console.log('\n✅ Sėjimas baigtas!')
  console.log('   Admin:   admin@turnyras.lt / admin123')
  console.log('   Teisėjas: teisejas@turnyras.lt / referee123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
