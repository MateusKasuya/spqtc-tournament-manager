CREATE TABLE "blind_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"level" integer NOT NULL,
	"small_blind" integer NOT NULL,
	"big_blind" integer NOT NULL,
	"ante" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL,
	CONSTRAINT "blind_structures_tournament_id_level_unique" UNIQUE("tournament_id","level")
);
--> statement-breakpoint
CREATE TABLE "prize_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"position" integer NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "prize_structures_tournament_id_position_unique" UNIQUE("tournament_id","position")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer,
	"name" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"buy_in_amount" integer NOT NULL,
	"rebuy_amount" integer DEFAULT 0 NOT NULL,
	"addon_amount" integer DEFAULT 0 NOT NULL,
	"initial_chips" integer NOT NULL,
	"rebuy_chips" integer DEFAULT 0 NOT NULL,
	"addon_chips" integer DEFAULT 0 NOT NULL,
	"max_rebuys" integer DEFAULT 0 NOT NULL,
	"allow_addon" boolean DEFAULT false NOT NULL,
	"prize_pool_override" integer,
	"current_blind_level" integer DEFAULT 0 NOT NULL,
	"timer_running" boolean DEFAULT false NOT NULL,
	"timer_remaining_secs" integer,
	"timer_started_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blind_structures" ADD CONSTRAINT "blind_structures_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_structures" ADD CONSTRAINT "prize_structures_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;