-- AlterTable
ALTER TABLE "tournament_configs" ADD COLUMN     "advanceMode" TEXT NOT NULL DEFAULT 'fixed',
ADD COLUMN     "advancePerGroup" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "advanceTotal" INTEGER NOT NULL DEFAULT 8;
