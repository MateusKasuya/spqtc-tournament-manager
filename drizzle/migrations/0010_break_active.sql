ALTER TABLE "tournaments" ADD COLUMN "break_active" boolean DEFAULT false NOT NULL;
ALTER TABLE "tournaments" ADD COLUMN "level_remaining_secs" integer;
