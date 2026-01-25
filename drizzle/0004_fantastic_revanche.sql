DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'issue_images') THEN
        CREATE TABLE "issue_images" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "issue_id" uuid NOT NULL,
            "comment_id" uuid,
            "uploaded_by" uuid,
            "full_image_url" text NOT NULL,
            "cropped_image_url" text,
            "full_blob_pathname" text NOT NULL,
            "cropped_blob_pathname" text,
            "file_size_bytes" integer NOT NULL,
            "mime_type" text NOT NULL,
            "original_filename" text,
            "deleted_at" timestamp with time zone,
            "deleted_by" uuid,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_images_issue_id_issues_id_fk') THEN
        ALTER TABLE "issue_images" ADD CONSTRAINT "issue_images_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_images_comment_id_issue_comments_id_fk') THEN
        ALTER TABLE "issue_images" ADD CONSTRAINT "issue_images_comment_id_issue_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."issue_comments"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_images_uploaded_by_user_profiles_id_fk') THEN
        ALTER TABLE "issue_images" ADD CONSTRAINT "issue_images_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issue_images_deleted_by_user_profiles_id_fk') THEN
        ALTER TABLE "issue_images" ADD CONSTRAINT "issue_images_deleted_by_user_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_images_issue_id" ON "issue_images" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_images_uploaded_by" ON "issue_images" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_images_deleted_at" ON "issue_images" USING btree ("deleted_at");
