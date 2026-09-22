ALTER TABLE "notification_preferences" ADD COLUMN "discord_onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notice_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO "notification_preferences" ("user_id", "discord_onboarded_at")
SELECT profile."id", now()
FROM "user_profiles" AS profile
LEFT JOIN "notification_preferences" AS prefs ON prefs."user_id" = profile."id"
WHERE profile."discord_user_id" IS NOT NULL
  AND prefs."user_id" IS NULL;--> statement-breakpoint
UPDATE "notification_preferences" AS prefs
SET "discord_onboarded_at" = now()
FROM "user_profiles" AS profile
WHERE prefs."user_id" = profile."id"
  AND profile."discord_user_id" IS NOT NULL;
