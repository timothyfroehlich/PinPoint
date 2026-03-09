-- Convert existing plain text to ProseMirror JSON before type change

-- machines.description
UPDATE "machines" SET "description" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "description")
      )
    )
  )
)
WHERE "description" IS NOT NULL;

ALTER TABLE "machines" ALTER COLUMN "description" SET DATA TYPE jsonb USING "description"::jsonb;

-- statement-breakpoint

-- machines.tournament_notes
UPDATE "machines" SET "tournament_notes" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "tournament_notes")
      )
    )
  )
)
WHERE "tournament_notes" IS NOT NULL;

ALTER TABLE "machines" ALTER COLUMN "tournament_notes" SET DATA TYPE jsonb USING "tournament_notes"::jsonb;

-- statement-breakpoint

-- machines.owner_requirements
UPDATE "machines" SET "owner_requirements" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "owner_requirements")
      )
    )
  )
)
WHERE "owner_requirements" IS NOT NULL;

ALTER TABLE "machines" ALTER COLUMN "owner_requirements" SET DATA TYPE jsonb USING "owner_requirements"::jsonb;

-- statement-breakpoint

-- machines.owner_notes
UPDATE "machines" SET "owner_notes" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "owner_notes")
      )
    )
  )
)
WHERE "owner_notes" IS NOT NULL;

ALTER TABLE "machines" ALTER COLUMN "owner_notes" SET DATA TYPE jsonb USING "owner_notes"::jsonb;

-- statement-breakpoint

-- issues.description
UPDATE "issues" SET "description" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "description")
      )
    )
  )
)
WHERE "description" IS NOT NULL;

ALTER TABLE "issues" ALTER COLUMN "description" SET DATA TYPE jsonb USING "description"::jsonb;

-- statement-breakpoint

-- issue_comments.content
UPDATE "issue_comments" SET "content" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', "content")
      )
    )
  )
)
WHERE "content" IS NOT NULL;

ALTER TABLE "issue_comments" ALTER COLUMN "content" SET DATA TYPE jsonb USING "content"::jsonb;
