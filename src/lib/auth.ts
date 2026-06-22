// ============================================================
// src/lib/auth.ts
// NextAuth prisijungimas. Administravimo aplinka priima tik ADMIN rolę.
// ============================================================

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider       from 'next-auth/providers/credentials'
import { prisma }                from './prisma'
import { compare }               from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'El. paštas', type: 'email' },
        password: { label: 'Slaptažodis', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })
        if (!user || !user.passwordHash) return null

        const valid = await compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, role: user.role, name: user.name }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },  // 12 val.
}

// ============================================================
// Prisma User modelio papildymas (pridėti prie schema.prisma)
// ============================================================
// model User {
//   id           String   @id @default(cuid())
//   email        String   @unique
//   name         String?
//   passwordHash String
//   role         UserRole @default(REFEREE)
//   createdAt    DateTime @default(now())
//   @@map("users")
// }
// enum UserRole { ADMIN REFEREE }


// ============================================================
// package.json
// ============================================================
// {
//   "name": "turnyras",
//   "version": "0.1.0",
//   "private": true,
//   "scripts": {
//     "dev":   "next dev",
//     "build": "next build",
//     "start": "next start",
//     "test":  "jest",
//     "db:migrate": "prisma migrate dev",
//     "db:seed":    "ts-node prisma/seed.ts",
//     "db:studio":  "prisma studio"
//   },
//   "dependencies": {
//     "next":              "14.2.0",
//     "react":             "18.3.0",
//     "react-dom":         "18.3.0",
//     "@prisma/client":    "5.14.0",
//     "next-auth":         "4.24.7",
//     "bcryptjs":          "2.4.3",
//     "zod":               "3.23.8"
//   },
//   "devDependencies": {
//     "prisma":            "5.14.0",
//     "@types/node":       "20.0.0",
//     "@types/react":      "18.3.0",
//     "@types/bcryptjs":   "2.4.6",
//     "typescript":        "5.4.0",
//     "jest":              "29.7.0",
//     "ts-jest":           "29.1.4",
//     "@types/jest":       "29.5.12",
//     "tailwindcss":       "3.4.0"
//   }
// }
