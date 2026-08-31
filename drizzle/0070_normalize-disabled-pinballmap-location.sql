-- Contract preparation: the next runtime treats nullable location_id as the
-- sole Pinball Map configuration signal and no longer reads enabled. Normalize
-- legacy disabled rows before that runtime is built so they stay dormant. The
-- previous deployment remains compatible because it still sees enabled=false.
UPDATE "pinballmap_state"
SET "location_id" = NULL
WHERE "enabled" = false;
