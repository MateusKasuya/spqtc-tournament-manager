CREATE TABLE "prize_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"levels" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prize_templates" ADD CONSTRAINT "prize_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;