-- DEVELOPMENT SEED (Local Dev Only) — DO NOT USE IN PROD
-- Contains sample models and machines for dev/test. Not for production.

-- =============================================================================
-- MODELS: Create exact 7 models from TypeScript extractUniqueGames()
-- =============================================================================
INSERT INTO models (id, name, manufacturer, year, opdb_id, is_active, created_at, updated_at) VALUES
  ('model_GBLLd-MdEON-A94po', 'Ultraman: Kaiju Rumble (Blood Sucker Edition)', 'Stern', 2024, 'GBLLd-MdEON-A94po', true, now(), now()),
  ('model_G42Pk-MZe2e', 'Xenon', 'Bally', 1980, 'G42Pk-MZe2e', true, now(), now()),
  ('model_GrknN-MQrdv', 'Cleopatra', 'Gottlieb', 1977, 'GrknN-MQrdv', true, now(), now()),
  ('model_G50Wr-MLeZP', 'Revenge from Mars', 'Williams', 1999, 'G50Wr-MLeZP', true, now(), now()),
  ('model_GR6d8-M1rZd', 'Star Trek: The Next Generation', 'Stern', 2013, 'GR6d8-M1rZd', true, now(), now()),
  ('model_GrqZX-MD15w', 'Lord of the Rings', 'Stern', 2003, 'GrqZX-MD15w', true, now(), now()),
  ('model_G5n2D-MLn85', 'Transporter the Rescue', NULL, NULL, 'G5n2D-MLn85', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  manufacturer = EXCLUDED.manufacturer,
  year = EXCLUDED.year,
  opdb_id = EXCLUDED.opdb_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =============================================================================
-- MACHINES: Create machines using exact SEED_TEST_IDS with correct schema
-- =============================================================================
-- Keep machine visibility inherited (NULL). Owner retained for now.
INSERT INTO machines (id, name, model_id, organization_id, location_id, owner_id, is_public, created_at, updated_at) VALUES
  -- Primary organization machines (using default primary location and admin user as owner)
  ('machine-mm-001', 'Ultraman: Kaiju Rumble (Blood Sucker Edition) #1', 'model_GBLLd-MdEON-A94po', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  ('machine-cc-001', 'Xenon #1', 'model_G42Pk-MZe2e', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  ('machine-rfm-001', 'Cleopatra #1', 'model_GrknN-MQrdv', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  ('machine-cleopatra-001', 'Revenge from Mars #1', 'model_G50Wr-MLeZP', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  ('machine-xenon-001', 'Star Trek: The Next Generation #1', 'model_GR6d8-M1rZd', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  ('machine-ultraman-001', 'Lord of the Rings #1', 'model_GrqZX-MD15w', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now()),
  -- Competitor organization machine
  ('machine-test-org-competitor-001', 'Transporter the Rescue #1', 'model_G5n2D-MLn85', 'test-org-competitor', 'location-default-competitor-001', '10000000-0000-4000-8000-000000000001', NULL, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  model_id = EXCLUDED.model_id,
  organization_id = EXCLUDED.organization_id,
  location_id = EXCLUDED.location_id,
  owner_id = EXCLUDED.owner_id,
  is_public = EXCLUDED.is_public,
  updated_at = now();
