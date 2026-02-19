DO $$ BEGIN
  ALTER TABLE "machines" ADD COLUMN "presence_status" text DEFAULT 'on_the_floor' NOT NULL;
EXCEPTION WHEN duplicate_column THEN
  -- Column already exists, skip
END $$;