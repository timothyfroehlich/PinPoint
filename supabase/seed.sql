-- PinPoint Supabase Infrastructure Setup
-- Modern seeding architecture: SQL for infrastructure, TypeScript for dynamic data

-- =============================================================================
-- STORAGE: Create file upload bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pinpoint-storage', 
  'pinpoint-storage', 
  true, 
  10485760, -- 10MB in bytes  
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- AUTH TRIGGER: Automatic User profile creation
-- =============================================================================
-- This eliminates auth-database coordination issues by automatically creating
-- a User database record whenever a Supabase auth user is created

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    name,
    email,
    email_verified,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.email_confirmed_at,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SECURITY: Row Level Security preparation
-- =============================================================================
-- Note: RLS policies will be implemented in Stage 3 of migration
-- This ensures the infrastructure is ready

-- Enable RLS on key tables (no policies yet - tables must exist first)
-- These will be uncommented in Stage 3:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."Issue" ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policy for unauthenticated/default role access
-- This policy blocks all access for users who are not authenticated or anon
-- NOTE: Moved to RLS setup script since tables must exist first
-- DO $$
-- BEGIN
--   -- Only create policy if it doesn't exist
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies 
--     WHERE schemaname = 'public' 
--     AND tablename = 'users' 
--     AND policyname = 'default_no_access_users'
--   ) THEN
--     EXECUTE 'CREATE POLICY default_no_access_users ON public.users 
--              FOR ALL TO public 
--              USING (false)';
--   END IF;
-- END $$;

-- =============================================================================
-- ANONYMOUS ACCESS: Cleanup function for rate limiting
-- =============================================================================

-- Add cleanup function for old anonymous rate limit entries
CREATE OR REPLACE FUNCTION cleanup_anonymous_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM anonymous_rate_limits 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MINIMAL SEED DATA: Infrastructure and Test Data
-- =============================================================================
-- This section contains the minimal seed data that was previously created
-- via TypeScript seeding scripts, now converted to SQL for universal compatibility

-- =============================================================================
-- GLOBAL PERMISSIONS: Create all permissions
-- =============================================================================
INSERT INTO permissions (id, name, description) VALUES
  ('perm-issue-view-001', 'issue:view', 'View issues in the organization'),
  ('perm-issue-create-002', 'issue:create', 'Create new issues'),
  ('perm-issue-edit-003', 'issue:edit', 'Edit existing issues'),
  ('perm-issue-delete-004', 'issue:delete', 'Delete issues'),
  ('perm-issue-assign-005', 'issue:assign', 'Assign issues to users'),
  ('perm-issue-bulk-manage-006', 'issue:bulk_manage', 'Bulk manage issues'),
  ('perm-machine-view-007', 'machine:view', 'View machines in the organization'),
  ('perm-machine-create-008', 'machine:create', 'Create new machines'),
  ('perm-machine-edit-009', 'machine:edit', 'Edit existing machines'),
  ('perm-machine-delete-010', 'machine:delete', 'Delete machines'),
  ('perm-location-view-011', 'location:view', 'View locations in the organization'),
  ('perm-location-create-012', 'location:create', 'Create new locations'),
  ('perm-location-edit-013', 'location:edit', 'Edit existing locations'),
  ('perm-location-delete-014', 'location:delete', 'Delete locations'),
  ('perm-attachment-view-015', 'attachment:view', 'View attachments'),
  ('perm-attachment-create-016', 'attachment:create', 'Create attachments'),
  ('perm-attachment-delete-017', 'attachment:delete', 'Delete attachments'),
  ('perm-org-manage-018', 'organization:manage', 'Manage organization settings'),
  ('perm-role-manage-019', 'role:manage', 'Manage roles and permissions'),
  ('perm-user-manage-020', 'user:manage', 'Manage users and memberships'),
  ('perm-admin-view-analytics-021', 'admin:view_analytics', 'View analytics and reports')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ORGANIZATIONS: Create two test organizations for RLS testing
-- =============================================================================
INSERT INTO organizations (id, name, subdomain, created_at, updated_at) VALUES
  ('test-org-pinpoint', 'Austin Pinball Collective', 'apc', now(), now()),
  ('test-org-competitor', 'Competitor Arcade', 'arcade-masters', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  updated_at = now();

-- =============================================================================
-- LOCATIONS: Create default locations for both organizations
-- =============================================================================
INSERT INTO locations (id, name, organization_id, is_public, created_at, updated_at) VALUES
  ('location-default-primary-001', 'Main Floor', 'test-org-pinpoint', true, now(), now()),
  ('location-default-competitor-001', 'Main Floor', 'test-org-competitor', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  organization_id = EXCLUDED.organization_id,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- =============================================================================
-- ROLES: Create system roles for both organizations
-- =============================================================================
INSERT INTO roles (id, name, description, organization_id, is_system, created_at, updated_at) VALUES
  -- Primary organization roles
  ('role-admin-primary-001', 'Admin', 'Full administrative access', 'test-org-pinpoint', true, now(), now()),
  ('role-member-primary-001', 'Member', 'Standard member access', 'test-org-pinpoint', true, now(), now()),
  ('role-unauth-primary-001', 'Unauthenticated', 'Public access without login', 'test-org-pinpoint', true, now(), now()),
  -- Competitor organization roles
  ('role-admin-competitor-001', 'Admin', 'Full administrative access', 'test-org-competitor', true, now(), now()),
  ('role-member-competitor-001', 'Member', 'Standard member access', 'test-org-competitor', true, now(), now()),
  ('role-unauth-competitor-001', 'Unauthenticated', 'Public access without login', 'test-org-competitor', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  organization_id = EXCLUDED.organization_id,
  is_system = EXCLUDED.is_system,
  updated_at = now();

-- =============================================================================
-- ROLE PERMISSIONS: Assign permissions to roles
-- =============================================================================
-- Admin roles get all permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  -- Primary organization admin permissions
  ('role-admin-primary-001', 'perm-issue-view-001'),
  ('role-admin-primary-001', 'perm-issue-create-002'),
  ('role-admin-primary-001', 'perm-issue-edit-003'),
  ('role-admin-primary-001', 'perm-issue-delete-004'),
  ('role-admin-primary-001', 'perm-issue-assign-005'),
  ('role-admin-primary-001', 'perm-issue-bulk-manage-006'),
  ('role-admin-primary-001', 'perm-machine-view-007'),
  ('role-admin-primary-001', 'perm-machine-create-008'),
  ('role-admin-primary-001', 'perm-machine-edit-009'),
  ('role-admin-primary-001', 'perm-machine-delete-010'),
  ('role-admin-primary-001', 'perm-location-view-011'),
  ('role-admin-primary-001', 'perm-location-create-012'),
  ('role-admin-primary-001', 'perm-location-edit-013'),
  ('role-admin-primary-001', 'perm-location-delete-014'),
  ('role-admin-primary-001', 'perm-attachment-view-015'),
  ('role-admin-primary-001', 'perm-attachment-create-016'),
  ('role-admin-primary-001', 'perm-attachment-delete-017'),
  ('role-admin-primary-001', 'perm-org-manage-018'),
  ('role-admin-primary-001', 'perm-role-manage-019'),
  ('role-admin-primary-001', 'perm-user-manage-020'),
  ('role-admin-primary-001', 'perm-admin-view-analytics-021'),
  -- Competitor organization admin permissions
  ('role-admin-competitor-001', 'perm-issue-view-001'),
  ('role-admin-competitor-001', 'perm-issue-create-002'),
  ('role-admin-competitor-001', 'perm-issue-edit-003'),
  ('role-admin-competitor-001', 'perm-issue-delete-004'),
  ('role-admin-competitor-001', 'perm-issue-assign-005'),
  ('role-admin-competitor-001', 'perm-issue-bulk-manage-006'),
  ('role-admin-competitor-001', 'perm-machine-view-007'),
  ('role-admin-competitor-001', 'perm-machine-create-008'),
  ('role-admin-competitor-001', 'perm-machine-edit-009'),
  ('role-admin-competitor-001', 'perm-machine-delete-010'),
  ('role-admin-competitor-001', 'perm-location-view-011'),
  ('role-admin-competitor-001', 'perm-location-create-012'),
  ('role-admin-competitor-001', 'perm-location-edit-013'),
  ('role-admin-competitor-001', 'perm-location-delete-014'),
  ('role-admin-competitor-001', 'perm-attachment-view-015'),
  ('role-admin-competitor-001', 'perm-attachment-create-016'),
  ('role-admin-competitor-001', 'perm-attachment-delete-017'),
  ('role-admin-competitor-001', 'perm-org-manage-018'),
  ('role-admin-competitor-001', 'perm-role-manage-019'),
  ('role-admin-competitor-001', 'perm-user-manage-020'),
  ('role-admin-competitor-001', 'perm-admin-view-analytics-021'),
  -- Member roles get standard permissions
  ('role-member-primary-001', 'perm-issue-view-001'),
  ('role-member-primary-001', 'perm-issue-create-002'),
  ('role-member-primary-001', 'perm-issue-edit-003'),
  ('role-member-primary-001', 'perm-machine-view-007'),
  ('role-member-primary-001', 'perm-location-view-011'),
  ('role-member-primary-001', 'perm-attachment-view-015'),
  ('role-member-primary-001', 'perm-attachment-create-016'),
  ('role-member-competitor-001', 'perm-issue-view-001'),
  ('role-member-competitor-001', 'perm-issue-create-002'),
  ('role-member-competitor-001', 'perm-issue-edit-003'),
  ('role-member-competitor-001', 'perm-machine-view-007'),
  ('role-member-competitor-001', 'perm-location-view-011'),
  ('role-member-competitor-001', 'perm-attachment-view-015'),
  ('role-member-competitor-001', 'perm-attachment-create-016'),
  -- Unauthenticated roles get view-only permissions
  ('role-unauth-primary-001', 'perm-issue-view-001'),
  ('role-unauth-primary-001', 'perm-machine-view-007'),
  ('role-unauth-primary-001', 'perm-location-view-011'),
  ('role-unauth-competitor-001', 'perm-issue-view-001'),
  ('role-unauth-competitor-001', 'perm-machine-view-007'),
  ('role-unauth-competitor-001', 'perm-location-view-011')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- PRIORITIES: Create priority levels for both organizations
-- =============================================================================
INSERT INTO priorities (id, name, color, weight, organization_id, created_at, updated_at) VALUES
  -- Primary organization priorities
  ('priority-low-primary-001', 'Low', '#22c55e', 1, 'test-org-pinpoint', now(), now()),
  ('priority-medium-primary-001', 'Medium', '#f59e0b', 2, 'test-org-pinpoint', now(), now()),
  ('priority-high-primary-001', 'High', '#ef4444', 3, 'test-org-pinpoint', now(), now()),
  ('priority-critical-primary-001', 'Critical', '#dc2626', 4, 'test-org-pinpoint', now(), now()),
  -- Competitor organization priorities
  ('priority-low-competitor-001', 'Low', '#22c55e', 1, 'test-org-competitor', now(), now()),
  ('priority-medium-competitor-001', 'Medium', '#f59e0b', 2, 'test-org-competitor', now(), now()),
  ('priority-high-competitor-001', 'High', '#ef4444', 3, 'test-org-competitor', now(), now()),
  ('priority-critical-competitor-001', 'Critical', '#dc2626', 4, 'test-org-competitor', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  weight = EXCLUDED.weight,
  organization_id = EXCLUDED.organization_id,
  updated_at = now();

-- =============================================================================
-- ISSUE STATUSES: Create status levels for both organizations
-- =============================================================================
INSERT INTO issue_statuses (id, name, category, color, organization_id, created_at, updated_at) VALUES
  -- Primary organization statuses
  ('status-new-primary-001', 'New', 'NEW', '#3b82f6', 'test-org-pinpoint', now(), now()),
  ('status-in-progress-primary-001', 'In Progress', 'IN_PROGRESS', '#f59e0b', 'test-org-pinpoint', now(), now()),
  ('status-needs-expert-primary-001', 'Needs Expert', 'IN_PROGRESS', '#8b5cf6', 'test-org-pinpoint', now(), now()),
  ('status-needs-parts-primary-001', 'Needs Parts', 'IN_PROGRESS', '#f97316', 'test-org-pinpoint', now(), now()),
  ('status-fixed-primary-001', 'Fixed', 'RESOLVED', '#22c55e', 'test-org-pinpoint', now(), now()),
  ('status-not-to-be-fixed-primary-001', 'Not to be Fixed', 'RESOLVED', '#6b7280', 'test-org-pinpoint', now(), now()),
  ('status-not-reproducible-primary-001', 'Not Reproducible', 'RESOLVED', '#64748b', 'test-org-pinpoint', now(), now()),
  -- Competitor organization statuses
  ('status-new-competitor-001', 'New', 'NEW', '#3b82f6', 'test-org-competitor', now(), now()),
  ('status-in-progress-competitor-001', 'In Progress', 'IN_PROGRESS', '#f59e0b', 'test-org-competitor', now(), now()),
  ('status-needs-expert-competitor-001', 'Needs Expert', 'IN_PROGRESS', '#8b5cf6', 'test-org-competitor', now(), now()),
  ('status-needs-parts-competitor-001', 'Needs Parts', 'IN_PROGRESS', '#f97316', 'test-org-competitor', now(), now()),
  ('status-fixed-competitor-001', 'Fixed', 'RESOLVED', '#22c55e', 'test-org-competitor', now(), now()),
  ('status-not-to-be-fixed-competitor-001', 'Not to be Fixed', 'RESOLVED', '#6b7280', 'test-org-competitor', now(), now()),
  ('status-not-reproducible-competitor-001', 'Not Reproducible', 'RESOLVED', '#64748b', 'test-org-competitor', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  color = EXCLUDED.color,
  organization_id = EXCLUDED.organization_id,
  updated_at = now();

-- =============================================================================
-- COLLECTION TYPES: Create collection types for both organizations
-- =============================================================================
INSERT INTO collection_types (id, name, organization_id, created_at, updated_at) VALUES
  -- Primary organization collection types
  ('collection-rooms-primary-001', 'Rooms', 'test-org-pinpoint', now(), now()),
  ('collection-manufacturer-primary-001', 'Manufacturer', 'test-org-pinpoint', now(), now()),
  ('collection-era-primary-001', 'Era', 'test-org-pinpoint', now(), now()),
  -- Competitor organization collection types
  ('collection-rooms-competitor-001', 'Rooms', 'test-org-competitor', now(), now()),
  ('collection-manufacturer-competitor-001', 'Manufacturer', 'test-org-competitor', now(), now()),
  ('collection-era-competitor-001', 'Era', 'test-org-competitor', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  organization_id = EXCLUDED.organization_id,
  updated_at = now();

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
INSERT INTO machines (id, name, model_id, organization_id, location_id, owner_id, is_public, created_at, updated_at) VALUES
  -- Primary organization machines (using default primary location and admin user as owner)
  ('machine-mm-001', 'Ultraman: Kaiju Rumble (Blood Sucker Edition) #1', 'model_GBLLd-MdEON-A94po', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  ('machine-cc-001', 'Xenon #1', 'model_G42Pk-MZe2e', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  ('machine-rfm-001', 'Cleopatra #1', 'model_GrknN-MQrdv', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  ('machine-cleopatra-001', 'Revenge from Mars #1', 'model_G50Wr-MLeZP', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  ('machine-xenon-001', 'Star Trek: The Next Generation #1', 'model_GR6d8-M1rZd', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  ('machine-ultraman-001', 'Lord of the Rings #1', 'model_GrqZX-MD15w', 'test-org-pinpoint', 'location-default-primary-001', '10000000-0000-4000-8000-000000000001', true, now(), now()),
  -- Competitor organization machine
  ('machine-test-org-competitor-001', 'Transporter the Rescue #1', 'model_G5n2D-MLn85', 'test-org-competitor', 'location-default-competitor-001', '10000000-0000-4000-8000-000000000001', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  model_id = EXCLUDED.model_id,
  organization_id = EXCLUDED.organization_id,
  location_id = EXCLUDED.location_id,
  owner_id = EXCLUDED.owner_id,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- =============================================================================
-- ISSUES: Create issues using SEED_TEST_IDS from minimal-issues.ts
-- =============================================================================
INSERT INTO issues (id, title, description, organization_id, machine_id, priority_id, status_id, created_by_id, created_at, updated_at) VALUES
  -- Issues using exact SEED_TEST_IDS constants
  ('issue-kaiju-figures-001', 'Kaiju figures on left ramp are not responding', 'Kaiju figures on left ramp are not responding', 'test-org-pinpoint', 'machine-mm-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-21 13:40:02+00', '2025-07-01 19:09:30+00'),
  ('issue-loud-buzzing-002', 'Loud buzzing noise then crashes', 'Loud buzzing noise then crashes', 'test-org-pinpoint', 'machine-xenon-001', 'priority-critical-primary-001', 'status-needs-expert-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-27 19:05:40+00', '2025-07-06 10:27:36+00'),
  ('issue-left-rollover-003', 'Left top rollover target not responding', 'Left top rollover target not responding', 'test-org-pinpoint', 'machine-cleopatra-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-27 20:12:44+00', '2025-07-01 19:10:53+00'),
  ('issue-right-gun-opto-004', 'Right gun opto is flakey - auto fires', 'Right gun opto is flakey - auto fires (current workaround -> power cycle)', 'test-org-pinpoint', 'machine-cc-001', 'priority-high-primary-001', 'status-in-progress-primary-001', '10000000-0000-4000-8000-000000000003', '2025-07-05 15:07:02+00', '2025-07-06 10:32:27+00'),
  ('issue-b-top-rollover-005', 'b top roll over does not register', 'b top roll over does not register', 'test-org-pinpoint', 'machine-cc-001', 'priority-low-primary-001', 'status-fixed-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-16 22:00:40+00', '2025-06-16 22:00:40+00'),
  ('issue-gun-calibration-006', 'Gun calibration was off - left side hits poor', 'Gun calibration was off - left side hits poor', 'test-org-pinpoint', 'machine-rfm-001', 'priority-low-primary-001', 'status-not-to-be-fixed-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-28 12:59:21+00', '2025-07-04 23:34:55+00'),
  ('issue-center-pop-bumper-007', 'Center pop bumper is out', 'Center pop bumper is out', 'test-org-pinpoint', 'machine-cleopatra-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-27 20:13:27+00', '2025-07-01 19:10:58+00'),
  ('issue-train-wreck-008', 'Train Wreck multiball drains too fast', 'Train Wreck multiball drains too fast - outlanes need adjustment', 'test-org-pinpoint', 'machine-cc-001', 'priority-high-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000001', '2025-07-08 14:22:15+00', '2025-07-08 14:22:15+00'),
  ('issue-magna-save-009', 'Magna save not responding consistently', 'Magna save button on the right side is intermittent', 'test-org-pinpoint', 'machine-rfm-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-07-09 10:15:30+00', '2025-07-09 10:15:30+00'),
  ('issue-castle-gate-010', 'Castle gate mechanism sticking', 'Castle gate mechanism sticking during Battle for the Kingdom mode', 'test-org-pinpoint', 'machine-mm-001', 'priority-high-primary-001', 'status-in-progress-primary-001', '10000000-0000-4000-8000-000000000001', '2025-07-10 16:45:00+00', '2025-07-10 16:45:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  organization_id = EXCLUDED.organization_id,
  machine_id = EXCLUDED.machine_id,
  priority_id = EXCLUDED.priority_id,
  status_id = EXCLUDED.status_id,
  created_by_id = EXCLUDED.created_by_id,
  updated_at = EXCLUDED.updated_at;