CREATE TABLE "machine_watchers" (
	"machine_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"watch_mode" text DEFAULT 'notify' NOT NULL,
	CONSTRAINT "machine_watchers_machine_id_user_id_pk" PRIMARY KEY("machine_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "machine_watchers" ADD CONSTRAINT "machine_watchers_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_watchers" ADD CONSTRAINT "machine_watchers_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_machine_watchers_user_id" ON "machine_watchers" USING btree ("user_id");
-- Seed existing owners as full subscribers
INSERT INTO "machine_watchers" ("machine_id", "user_id", "watch_mode")
SELECT "id", "owner_id", 'subscribe'
FROM "machines"
WHERE "owner_id" IS NOT NULL
ON CONFLICT ("machine_id", "user_id") DO NOTHING;
