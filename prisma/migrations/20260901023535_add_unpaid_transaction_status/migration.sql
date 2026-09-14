/*
  Warnings:

  - You are about to drop the column `code` on the `courts` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'UNPAID';

-- DropIndex
DROP INDEX "courts_code_key";

-- AlterTable
ALTER TABLE "courts" DROP COLUMN "code";
