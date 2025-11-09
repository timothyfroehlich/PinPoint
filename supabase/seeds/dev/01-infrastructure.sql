-- DEVELOPMENT SEED (Local Dev Only) — DO NOT USE IN PROD
-- Contains sample organizations, roles, role-permissions, and root locations for dev/test.
-- Production/Preview should run base seeds in supabase/seeds/base/*.sql only.

-- =============================================================================
-- GLOBAL PERMISSIONS: Create all permissions
-- =============================================================================
INSERT INTO permissions (id, name, description) VALUES
  ('perm-issue-view-001', 'issue:view', 'View issues in the organization'),
  -- New split create permissions
  ('perm-issue-create-basic-002a', 'issue:create_basic', 'Create new issues (basic fields only)'),
  ('perm-issue-create-full-002b', 'issue:create_full', 'Create new issues with priority and assignee control'),
  ('perm-issue-edit-003', 'issue:edit', 'Edit existing issues'),
  ('perm-issue-delete-004', 'issue:delete', 'Delete issues'),
  ('perm-issue-assign-005', 'issue:assign', '(Deprecated) Assign issues to users'),
  ('perm-issue-bulk-manage-006', 'issue:bulk_manage', '(Deprecated) Bulk manage issues'),
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
  ('perm-admin-view-analytics-021', 'admin:view_analytics', 'View analytics and reports'),
  ('perm-comment-moderate-022', 'comment:moderate', 'Moderate comments')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ORGANIZATIONS: Create two test organizations for RLS testing
-- =============================================================================
-- Minimal org seed with visibility defaults
INSERT INTO organizations (id, name, subdomain, is_public, public_issue_default, created_at, updated_at) VALUES
  ('test-org-pinpoint', 'Austin Pinball Collective', 'apc', true, 'private', now(), now()),
  ('test-org-competitor', 'Competitor Arcade', 'arcade-masters', true, 'public', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  is_public = EXCLUDED.is_public,
  public_issue_default = EXCLUDED.public_issue_default,
  updated_at = now();

-- =============================================================================
-- LOCATIONS: Create default locations for both organizations
-- =============================================================================
-- Keep descendant visibility inherited (NULL) by default
INSERT INTO locations (id, name, organization_id, is_public, created_at, updated_at) VALUES
  ('location-default-primary-001', 'Main Floor', 'test-org-pinpoint', NULL, now(), now()),
  ('location-default-competitor-001', 'Main Floor', 'test-org-competitor', NULL, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  organization_id = EXCLUDED.organization_id,
  is_public = EXCLUDED.is_public,
  updated_at = now();

-- =============================================================================
-- ROLES: Create system roles for both organizations
-- =============================================================================
INSERT INTO roles (id, name, organization_id, is_system, created_at, updated_at) VALUES
  -- Primary organization roles
  ('role-admin-primary-001', 'Admin', 'test-org-pinpoint', true, now(), now()),
  ('role-member-primary-001', 'Member', 'test-org-pinpoint', true, now(), now()),
  ('role-unauth-primary-001', 'Unauthenticated', 'test-org-pinpoint', true, now(), now()),
  -- Competitor organization roles
  ('role-admin-competitor-001', 'Admin', 'test-org-competitor', true, now(), now()),
  ('role-member-competitor-001', 'Member', 'test-org-competitor', true, now(), now()),
  ('role-unauth-competitor-001', 'Unauthenticated', 'test-org-competitor', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  organization_id = EXCLUDED.organization_id,
  is_system = EXCLUDED.is_system,
  updated_at = now();

-- =============================================================================
-- ROLE PERMISSIONS: Assign permissions to roles
-- =============================================================================
-- Admin roles get all permissions
-- Insert role permissions if not already present (no unique constraint on table)
INSERT INTO role_permissions (role_id, permission_id)
SELECT v.role_id, v.permission_id
FROM (VALUES
  -- Primary organization admin permissions
  ('role-admin-primary-001', 'perm-issue-view-001'),
  ('role-admin-primary-001', 'perm-issue-create-full-002b'),
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
  ('role-admin-primary-001', 'perm-comment-moderate-022'),
  -- Competitor organization admin permissions
  ('role-admin-competitor-001', 'perm-issue-view-001'),
  ('role-admin-competitor-001', 'perm-issue-create-full-002b'),
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
  ('role-admin-competitor-001', 'perm-comment-moderate-022'),
  -- Member roles get standard permissions
  ('role-member-primary-001', 'perm-issue-view-001'),
  -- Member roles get full create (implicitly includes basic)
  ('role-member-primary-001', 'perm-issue-create-full-002b'),
  ('role-member-primary-001', 'perm-issue-edit-003'),
  ('role-member-primary-001', 'perm-machine-view-007'),
  ('role-member-primary-001', 'perm-location-view-011'),
  ('role-member-primary-001', 'perm-attachment-view-015'),
  ('role-member-primary-001', 'perm-attachment-create-016'),
  ('role-member-competitor-001', 'perm-issue-view-001'),
  ('role-member-competitor-001', 'perm-issue-create-full-002b'),
  ('role-member-competitor-001', 'perm-issue-edit-003'),
  ('role-member-competitor-001', 'perm-machine-view-007'),
  ('role-member-competitor-001', 'perm-location-view-011'),
  ('role-member-competitor-001', 'perm-attachment-view-015'),
  ('role-member-competitor-001', 'perm-attachment-create-016'),
  -- Unauthenticated roles get view-only permissions
  ('role-unauth-primary-001', 'perm-issue-view-001'),
  -- Allow basic create for unauth (public issue reporting)
  ('role-unauth-primary-001', 'perm-issue-create-basic-002a'),
  ('role-unauth-primary-001', 'perm-machine-view-007'),
  ('role-unauth-primary-001', 'perm-location-view-011'),
  ('role-unauth-competitor-001', 'perm-issue-view-001'),
  ('role-unauth-competitor-001', 'perm-issue-create-basic-002a'),
  ('role-unauth-competitor-001', 'perm-machine-view-007'),
  ('role-unauth-competitor-001', 'perm-location-view-011')
) AS v(role_id, permission_id)
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = v.role_id AND rp.permission_id = v.permission_id
);
