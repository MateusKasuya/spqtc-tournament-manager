ALTER TABLE "tournaments" ADD COLUMN "bonus_chip_amount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "participants" ADD COLUMN "bonus_chip_used" boolean DEFAULT false NOT NULL;
