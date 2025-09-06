-- Loads constant helper functions for pgTAP tests (organization IDs, user IDs, JWT helpers)
-- Ensures functions like test_org_primary() exist before any *.test.sql executes.
\echo 'Loading test helper constants (constants.sql)'
\ir ../constants.sql
