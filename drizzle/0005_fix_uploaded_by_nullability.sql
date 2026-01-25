-- Custom migration to ensure uploaded_by is nullable
-- This fixes issues where the table might have been created with NOT NULL in a previous version
ALTER TABLE "issue_images" ALTER COLUMN "uploaded_by" DROP NOT NULL;
