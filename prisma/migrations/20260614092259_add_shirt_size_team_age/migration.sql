-- AlterEnum
ALTER TYPE "KnockoutFormat" ADD VALUE 'LUCKY_LOSER';

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "shirtSize" TEXT;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "teamAge" INTEGER;
