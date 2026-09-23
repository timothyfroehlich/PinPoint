ALTER TABLE "user_profiles" ADD COLUMN "mobile_report_mode" text DEFAULT 'quick' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "desktop_report_mode" text DEFAULT 'detailed' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_mobile_report_mode_check" CHECK (mobile_report_mode IN ('quick', 'detailed', 'multiple'));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_desktop_report_mode_check" CHECK (desktop_report_mode IN ('quick', 'detailed', 'multiple'));