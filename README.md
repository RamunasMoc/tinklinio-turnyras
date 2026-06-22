# Paplūdimio tinklinio turnyro sistema
## Next.js 14 · Prisma · PostgreSQL · NextAuth

## Greitas startas

```bash
npm install
cp .env.example .env   # užpildyti DATABASE_URL ir NEXTAUTH_SECRET
npx prisma migrate dev --name init
npx prisma generate
npx ts-node prisma/seed.ts
npm run dev
```

## Visi failai

| Failas | Aprašas |
|--------|---------|
| `prisma/schema.prisma` | Visos DB lentelės ir ryšiai |
| `prisma/seed.ts` | Demo duomenys (16 komandų, admin, teisėjas) |
| `src/types/index.ts` | Bendri DTO tipai |
| `src/lib/prisma.ts` | Prisma singleton |
| `src/lib/auth.ts` | NextAuth (ADMIN / REFEREE rolės) |
| `src/lib/middleware/auth.ts` | `withAuth` HOF, `jsonOk/jsonErr` |
| `src/lib/import/*` | CSV/TSV/txt importo modulis |
| `src/lib/tournament/draw.ts` | Burtų traukimas su sėjamosiomis |
| `src/lib/tournament/standings.ts` | Grupių lentelė pagal FIVB taisykles |
| `src/lib/tournament/schedule.ts` | Tvarkaraščio generatorius |
| `src/lib/bracket.ts` | Single/Double elimination braket |
| `src/lib/tournament/koSchedule.ts` | KO tvarkaraštis su aikštelėmis |
| `src/app/api/tournaments/route.ts` | GET sąrašas, POST kurti |
| `src/app/api/tournaments/[id]/teams/route.ts` | Komandų CRUD |
| `src/app/api/tournaments/[id]/teams/import/route.ts` | Tekstinis importas |
| `src/app/api/tournaments/[id]/matches/route.ts` | Rezultatai, tvarkaraštis, KO |

## .env

```env
DATABASE_URL="postgresql://user:password@localhost:5432/turnyras"
NEXTAUTH_SECRET="ilgas-atsitiktinis-tekstas-min-32-simboliai"
NEXTAUTH_URL="http://localhost:3000"
```

## Turnyro eiga

```
DRAFT → konfigūracija + komandos + burtai → GROUPS
GROUPS → grupių rezultatai → KNOCKOUT
KNOCKOUT → KO rezultatai → FINISHED
```
