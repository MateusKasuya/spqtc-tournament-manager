ALTER TABLE "tournaments" ADD COLUMN "tournament_type" text DEFAULT 'normal' NOT NULL;
ALTER TABLE "tournaments" ADD COLUMN "bounty_percentage" integer DEFAULT 50 NOT NULL;
ALTER TABLE "participants" ADD COLUMN "current_bounty" integer DEFAULT 0 NOT NULL;
ALTER TABLE "participants" ADD COLUMN "eliminated_by_ids" jsonb DEFAULT '[]' NOT NULL;
ALTER TABLE "participants" ADD COLUMN "bounties_collected" integer DEFAULT 0 NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "bounty_change" integer DEFAULT 0 NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "related_participant_id" integer REFERENCES "participants"("id") ON DELETE SET NULL;
