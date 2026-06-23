CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"role" text DEFAULT 'player' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_nickname_unique" UNIQUE("nickname")
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
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nickname" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_nickname_unique" UNIQUE("nickname"),
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_type" text DEFAULT 'normal' NOT NULL,
	"bounty_percentage" integer DEFAULT 50 NOT NULL,
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
	"bonus_chip_amount" integer DEFAULT 0 NOT NULL,
	"max_rebuys" integer DEFAULT 0 NOT NULL,
	"allow_addon" boolean DEFAULT false NOT NULL,
	"prize_pool_override" integer,
	"ranking_fee_amount" integer DEFAULT 0 NOT NULL,
	"current_blind_level" integer DEFAULT 0 NOT NULL,
	"timer_running" boolean DEFAULT false NOT NULL,
	"timer_remaining_secs" integer,
	"timer_started_at" timestamp with time zone,
	"break_active" boolean DEFAULT false NOT NULL,
	"level_remaining_secs" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE no action ON UPDATE no action,
	FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "blind_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"level" integer NOT NULL,
	"small_blind" integer NOT NULL,
	"big_blind" integer NOT NULL,
	"ante" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL,
	"is_addon_level" boolean DEFAULT false NOT NULL,
	"is_big_ante" boolean DEFAULT false NOT NULL,
	CONSTRAINT "blind_structures_tournament_id_level_unique" UNIQUE("tournament_id","level"),
	FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "prize_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"position" integer NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	CONSTRAINT "prize_structures_tournament_id_position_unique" UNIQUE("tournament_id","position"),
	FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"buy_in_paid" boolean DEFAULT false NOT NULL,
	"rebuy_count" integer DEFAULT 0 NOT NULL,
	"addon_count" integer DEFAULT 0 NOT NULL,
	"bonus_chip_used" boolean DEFAULT false NOT NULL,
	"finish_position" integer,
	"points_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"prize_amount" integer DEFAULT 0 NOT NULL,
	"current_bounty" integer DEFAULT 0 NOT NULL,
	"eliminated_by_ids" jsonb DEFAULT '[]' NOT NULL,
	"bounties_collected" integer DEFAULT 0 NOT NULL,
	"eliminated_at" timestamp with time zone,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_tournament_id_player_id_unique" UNIQUE("tournament_id","player_id"),
	FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE cascade ON UPDATE no action,
	FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"bounty_change" integer DEFAULT 0 NOT NULL,
	"related_participant_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE cascade ON UPDATE no action,
	FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE no action ON UPDATE no action,
	FOREIGN KEY ("related_participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "blind_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"levels" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "prize_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"levels" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action
);
