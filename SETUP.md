# Paleidimo instrukcija

## 1. Reikalavimai

- Node.js 18+
- PostgreSQL 14+ (arba Railway/Supabase nemokamas planas)

---

## 2. Vietinis paleidimas

```bash
# Klonuoti / atsisiųsti projektą
cd turnyras
npm install

# Sukurti .env failą
cp .env.example .env
# Atidaryti .env ir užpildyti DATABASE_URL

# Jei nėra PostgreSQL — greičiausias būdas su Docker:
docker run -d \
  --name turnyras-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=turnyras \
  -p 5432:5432 \
  postgres:16
# Tada DATABASE_URL="postgresql://postgres:password@localhost:5432/turnyras"

# Sugeneruoti NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Rezultatą įklijuoti į .env prie NEXTAUTH_SECRET

# Sukurti DB lenteles ir užsėti demo duomenis
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed

# Paleisti
npm run dev
# → http://localhost:3000
```

Prisijungimo duomenys po seed:
- Admin: `admin@turnyras.lt` / `admin123`
- Teisėjas: `teisejas@turnyras.lt` / `referee123`

---

## 3. Deploy į Railway (rekomenduojama)

```bash
# Įdiegti Railway CLI
npm install -g @railway/cli
railway login

# Naujas projektas
railway init
railway add postgresql    # automatiškai sukuria DB ir nustato DATABASE_URL

# Env kintamieji
railway variables set NEXTAUTH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
railway variables set NEXTAUTH_URL="https://jusu-projektas.up.railway.app"

# Deploy
railway up

# Migracijos ir seed
railway run npx prisma migrate deploy
railway run npm run db:seed
```

---

## 4. Deploy į Vercel + Supabase

```bash
# Supabase: sukurti naują projektą → Settings → Database → Connection string
# Naudoti "Transaction mode" URL (port 6543)

# Vercel
npm install -g vercel
vercel

# Env kintamieji Vercel dashboard:
# DATABASE_URL=postgresql://...  (iš Supabase)
# NEXTAUTH_SECRET=...
# NEXTAUTH_URL=https://jusu-projektas.vercel.app

# Migracijos
vercel env pull .env.local
npx prisma migrate deploy
```

---

## 5. Naujo turnyro sukūrimas (API sekos)

```bash
# 1. Prisijungti ir gauti sesiją
POST /api/auth/signin

# 2. Sukurti turnyra
POST /api/tournaments
{ "name": "...", "startsAt": "2025-08-02T09:00:00Z", "category": "M", ... }

# 3. Išsaugoti konfigūraciją
PUT /api/tournaments/:id/config
{ "numGroups": 4, "groupSetFormat": "BO2_21", ... }

# 4. Registruoti komandas (arba importuoti)
POST /api/tournaments/:id/teams
POST /api/tournaments/:id/teams/import

# 5. Generuoti grupes + burtai
POST /api/tournaments/:id/groups
{ "groupSizes": [4,4,4,4], "advanceCounts": [2,2,2,2] }

# 6. Generuoti tvarkaraštį
POST /api/tournaments/:id/schedule

# 7. Vesti rezultatus
PUT /api/tournaments/:id/matches/:matchId/sets
{ "sets": [{ "setNumber":1, "homeScore":21, "awayScore":18, "isTiebreak":false }, ...] }

# 8. Generuoti atkrintamąsias
POST /api/tournaments/:id/knockout  { "action": "generate" }

# 9. Planuoti KO laiką
POST /api/tournaments/:id/knockout  { "action": "schedule", "courts": [...], ... }
```

---

## 6. Failų struktūra (visi failai)

```
turnyras/
├── .env.example
├── next.config.ts
├── tsconfig.json
├── tsconfig.seed.json
├── tailwind.config.ts
├── postcss.config.js
├── jest.config.ts
├── package.json
│
├── prisma/
│   ├── schema.prisma          ← DB schema (9 modeliai)
│   └── seed.ts                ← Demo duomenys
│
└── src/
    ├── types/index.ts         ← Visi DTO tipai
    │
    ├── lib/
    │   ├── prisma.ts
    │   ├── auth.ts
    │   ├── middleware/auth.ts
    │   ├── import/            ← CSV/TSV/txt importas
    │   │   ├── types.ts
    │   │   ├── age.ts
    │   │   ├── parsers.ts
    │   │   ├── validate.ts
    │   │   ├── save.ts
    │   │   └── index.ts
    │   └── tournament/
    │       ├── draw.ts        ← Burtai
    │       ├── schedule.ts    ← Tvarkaraštis
    │       ├── standings.ts   ← FIVB lentelė
    │       ├── bracket.ts     ← Single/Double elim
    │       └── koSchedule.ts  ← KO aikštelės
    │
    └── app/
        ├── api/
        │   ├── auth/route.ts
        │   └── tournaments/
        │       ├── route.ts
        │       └── [id]/
        │           ├── route.ts
        │           ├── config/route.ts
        │           ├── teams/route.ts
        │           ├── teams/import/route.ts
        │           ├── groups/route.ts
        │           ├── groups/draw/route.ts
        │           ├── matches/route.ts
        │           ├── schedule/route.ts
        │           └── knockout/route.ts
        ├── (admin)/           ← Administratoriaus puslapiai
        └── (public)/          ← Viešas rodinys
```
