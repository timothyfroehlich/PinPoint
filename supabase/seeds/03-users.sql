-- PinPoint Users & Memberships Seeding
-- Test users and their organization memberships
-- Universal PostgreSQL - works in any PostgreSQL environment

-- =============================================================================
-- TEST USERS: Create test users for development and testing
-- =============================================================================
INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Tim Froehlich', 'tim.froehlich@example.com', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'Harry Williams', 'harry.williams@example.com', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'Escher Lefkoff', 'escher.lefkoff@example.com', now(), now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  email_verified = EXCLUDED.email_verified,
  updated_at = now();

-- =============================================================================
-- MEMBERSHIPS: Assign users to organizations with roles
-- =============================================================================
INSERT INTO memberships (id, user_id, organization_id, role_id, created_at, updated_at) VALUES
  -- Primary organization memberships
  ('membership-admin-primary-001', '10000000-0000-4000-8000-000000000001', 'test-org-pinpoint', 'role-admin-primary-001', now(), now()),
  ('membership-member1-primary-001', '10000000-0000-4000-8000-000000000002', 'test-org-pinpoint', 'role-member-primary-001', now(), now()),
  ('membership-member2-primary-001', '10000000-0000-4000-8000-000000000003', 'test-org-pinpoint', 'role-member-primary-001', now(), now()),
  -- Competitor organization memberships
  ('membership-admin-competitor-001', '10000000-0000-4000-8000-000000000001', 'test-org-competitor', 'role-admin-competitor-001', now(), now()),
  ('membership-member1-competitor-001', '10000000-0000-4000-8000-000000000002', 'test-org-competitor', 'role-member-competitor-001', now(), now()),
  ('membership-member2-competitor-001', '10000000-0000-4000-8000-000000000003', 'test-org-competitor', 'role-member-competitor-001', now(), now())
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  organization_id = EXCLUDED.organization_id,
  role_id = EXCLUDED.role_id,
  updated_at = now();