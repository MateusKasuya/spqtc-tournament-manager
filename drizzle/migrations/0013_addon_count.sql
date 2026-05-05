ALTER TABLE "participants" ADD COLUMN "addon_count" integer DEFAULT 0 NOT NULL;
UPDATE "participants" SET "addon_count" = 1 WHERE "addon_used" = true;
ALTER TABLE "participants" DROP COLUMN "addon_used";
