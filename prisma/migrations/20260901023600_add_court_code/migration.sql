-- Add code column to courts table
ALTER TABLE "courts" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';

-- Populate code from name for any existing rows (uppercased, spaces to dashes)
UPDATE "courts" SET "code" = UPPER(REGEXP_REPLACE(TRIM(name), '[^A-Z0-9]+', '-', 'gi'));

-- Remove the temporary default
ALTER TABLE "courts" ALTER COLUMN "code" DROP DEFAULT;

-- Add unique constraint
CREATE UNIQUE INDEX "courts_code_key" ON "courts"("code");
