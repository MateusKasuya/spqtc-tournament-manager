CREATE INDEX "tournaments_season_status_idx" ON "tournaments" USING btree ("season_id","status");--> statement-breakpoint
CREATE INDEX "transactions_tournament_id_idx" ON "transactions" USING btree ("tournament_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");