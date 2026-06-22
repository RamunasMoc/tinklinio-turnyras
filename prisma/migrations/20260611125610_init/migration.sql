-- CreateEnum
CREATE TYPE "Category" AS ENUM ('M', 'W', 'X');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('U18', 'U21', 'U23', 'OPEN', 'PLUS40', 'PLUS50');

-- CreateEnum
CREATE TYPE "SetFormat" AS ENUM ('BO2_21', 'BO2_15', 'ONE_21', 'ONE_15');

-- CreateEnum
CREATE TYPE "TiebreakPoints" AS ENUM ('ELEVEN', 'FIFTEEN');

-- CreateEnum
CREATE TYPE "DrawMethod" AS ENUM ('RANDOM', 'SEEDED_RANDOM', 'SNAKE', 'MANUAL');

-- CreateEnum
CREATE TYPE "KnockoutFormat" AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "PointSystem" AS ENUM ('WIN_LOSS', 'TWO_ONE', 'SET_RATIO');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'GROUPS', 'KNOCKOUT', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'WALKOVER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REFEREE');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "category" "Category" NOT NULL,
    "ageGroup" "AgeGroup",
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_configs" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "numGroups" INTEGER NOT NULL DEFAULT 4,
    "groupSetFormat" "SetFormat" NOT NULL DEFAULT 'BO2_21',
    "groupTiebreakPoints" INTEGER NOT NULL DEFAULT 15,
    "groupTimeMinutes" INTEGER NOT NULL DEFAULT 45,
    "groupCourts" INTEGER NOT NULL DEFAULT 4,
    "groupPointSystem" "PointSystem" NOT NULL DEFAULT 'TWO_ONE',
    "groupBreakMinutes" INTEGER NOT NULL DEFAULT 10,
    "drawMethod" "DrawMethod" NOT NULL DEFAULT 'RANDOM',
    "numSeeds" INTEGER NOT NULL DEFAULT 0,
    "clubRule" BOOLEAN NOT NULL DEFAULT false,
    "knockoutFormat" "KnockoutFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "knockoutSetFormat" "SetFormat" NOT NULL DEFAULT 'BO2_21',
    "knockoutTiebreakPoints" INTEGER NOT NULL DEFAULT 15,
    "finalSetFormat" "SetFormat" NOT NULL DEFAULT 'BO2_21',
    "knockoutTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "knockoutCourts" INTEGER NOT NULL DEFAULT 2,
    "thirdPlaceMatch" BOOLEAN NOT NULL DEFAULT true,
    "knockoutStartsAt" TIMESTAMP(3),
    "lunchBreakMinutes" INTEGER,
    "lunchBreakAt" TIMESTAMP(3),

    CONSTRAINT "tournament_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "seedRank" INTEGER,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT,
    "groupWins" INTEGER NOT NULL DEFAULT 0,
    "groupLosses" INTEGER NOT NULL DEFAULT 0,
    "groupPoints" INTEGER NOT NULL DEFAULT 0,
    "groupSetsWon" INTEGER NOT NULL DEFAULT 0,
    "groupSetsLost" INTEGER NOT NULL DEFAULT 0,
    "groupPtsWon" INTEGER NOT NULL DEFAULT 0,
    "groupPtsLost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "club" TEXT,
    "category" "Category",
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "ageYears" INTEGER,
    "playerOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "maxTeams" INTEGER NOT NULL,
    "advanceCount" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "groupId" TEXT,
    "round" TEXT,
    "matchNumber" INTEGER,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "court" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeSets" INTEGER,
    "awaySets" INTEGER,
    "winnerId" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "isTiebreak" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'REFEREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_configs_tournamentId_key" ON "tournament_configs"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_teams_tournamentId_teamId_key" ON "tournament_teams"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "groups_tournamentId_name_key" ON "groups"("tournamentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sets_matchId_setNumber_key" ON "sets"("matchId", "setNumber");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "tournament_configs" ADD CONSTRAINT "tournament_configs_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sets" ADD CONSTRAINT "sets_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
