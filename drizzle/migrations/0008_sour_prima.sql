CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_nickname_unique" UNIQUE("nickname")
);
--> statement-breakpoint
ALTER TABLE "tournament_results" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "tournament_results" CASCADE;--> statement-breakpoint
ALTER TABLE "participants" RENAME COLUMN "user_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "transactions" RENAME COLUMN "user_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_tournament_id_user_id_unique";--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tournament_id_player_id_unique" UNIQUE("tournament_id","player_id");