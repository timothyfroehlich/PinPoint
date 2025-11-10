-- BASE SEED (Prod/Preview Safe): Global Permissions Only
-- No organizations, users, roles, or dev/test sample data here.
-- No orgs, users, roles, or sample data

INSERT INTO permissions (id, name, description) VALUES
  ('perm-issue-view-001', 'issue:view', 'View issues in the organization'),
  -- Legacy create (pre-beta) kept for backward compatibility; treated as FULL
  ('perm-issue-create-002', 'issue:create', '(Legacy) Create new issues (treated as full access)'),
  -- New split create permissions
  ('perm-issue-create-basic-002a', 'issue:create_basic', 'Create new issues (basic fields only)'),
  ('perm-issue-create-full-002b', 'issue:create_full', 'Create new issues with priority and assignee control'),
  ('perm-issue-edit-003', 'issue:edit', 'Edit existing issues'),
  ('perm-issue-delete-004', 'issue:delete', 'Delete issues'),
  -- Deprecated: will be merged into issue:edit
  ('perm-issue-assign-005', 'issue:assign', '(Deprecated) Assign issues to users'),
  -- Deprecated: will be merged into issue:edit
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
