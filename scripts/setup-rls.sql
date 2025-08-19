-- =================================================================
-- PinPoint Row Level Security (RLS) Setup
-- =================================================================
-- 
-- Complete RLS policy definitions for multi-tenant database architecture
-- Uses Supabase auth.jwt() pattern for organization isolation
-- 
-- Key Features:
-- - Organization-level isolation for all multi-tenant tables
-- - Automatic organizationId injection via triggers
-- - Complex inheritance patterns for collections/collectionMachines
-- - Performance-optimized indexes for RLS queries
-- 
-- Integration: Part of enhanced database reset workflow
-- Usage: npm run db:setup-rls (or npm run db:reset:local:sb)
-- =================================================================

-- =================================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- =================================================================

-- Core organizational tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Location and machine management
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

-- Issue management system
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- Collection management
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_machines ENABLE ROW LEVEL SECURITY;

-- Notification system
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PinballMap integration
ALTER TABLE pinball_map_configs ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. DROP EXISTING POLICIES (IF ANY)
-- =================================================================

-- Core organizational policies
DROP POLICY IF EXISTS "organization_isolation" ON organizations;
DROP POLICY IF EXISTS "memberships_organization_isolation" ON memberships;
DROP POLICY IF EXISTS "roles_organization_isolation" ON roles;
DROP POLICY IF EXISTS "permissions_global_read" ON permissions;
DROP POLICY IF EXISTS "role_permissions_organization_isolation" ON role_permissions;

-- Location and machine policies
DROP POLICY IF EXISTS "locations_organization_isolation" ON locations;
DROP POLICY IF EXISTS "machines_organization_isolation" ON machines;
DROP POLICY IF EXISTS "models_global_read" ON models;

-- Issue management policies
DROP POLICY IF EXISTS "issues_organization_isolation" ON issues;
DROP POLICY IF EXISTS "priorities_organization_isolation" ON priorities;
DROP POLICY IF EXISTS "issue_statuses_organization_isolation" ON issue_statuses;
DROP POLICY IF EXISTS "comments_organization_isolation" ON comments;
DROP POLICY IF EXISTS "attachments_organization_isolation" ON attachments;
DROP POLICY IF EXISTS "issue_history_organization_isolation" ON issue_history;
DROP POLICY IF EXISTS "upvotes_organization_isolation" ON upvotes;

-- Collection management policies
DROP POLICY IF EXISTS "collections_organization_isolation" ON collections;
DROP POLICY IF EXISTS "collection_types_organization_isolation" ON collection_types;
DROP POLICY IF EXISTS "collection_machines_organization_isolation" ON collection_machines;

-- Notification and config policies
DROP POLICY IF EXISTS "notifications_organization_isolation" ON notifications;
DROP POLICY IF EXISTS "pinball_map_configs_organization_isolation" ON pinball_map_configs;

-- =================================================================
-- 3. ORGANIZATION ISOLATION POLICIES
-- =================================================================

-- Organizations: Users can only access their own organization
-- LOCAL DEV: Allow all access when auth.jwt() is null (local development)
CREATE POLICY "organization_isolation" ON organizations
  FOR ALL TO authenticated
  USING (auth.jwt() IS NULL OR id = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Memberships: Users can only see memberships in their organization
CREATE POLICY "memberships_organization_isolation" ON memberships
  FOR ALL TO authenticated
  USING (auth.jwt() IS NULL OR "organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Roles: Organization-scoped role management
CREATE POLICY "roles_organization_isolation" ON roles
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Permissions: Global read access (permissions are system-wide)
CREATE POLICY "permissions_global_read" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- Role Permissions: Scoped via role relationship
CREATE POLICY "role_permissions_organization_isolation" ON "rolePermissions"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles
      WHERE roles.id = "rolePermissions"."roleId"
      AND roles."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- =================================================================
-- 4. LOCATION AND MACHINE POLICIES
-- =================================================================

-- Locations: Direct organization isolation
CREATE POLICY "locations_organization_isolation" ON locations
  FOR ALL TO authenticated
  USING (auth.jwt() IS NULL OR "organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Machines: Direct organization isolation
CREATE POLICY "machines_organization_isolation" ON machines
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Models: Global read access (models are system-wide)
CREATE POLICY "models_global_read" ON models
  FOR SELECT TO authenticated
  USING (true);

-- =================================================================
-- 5. ISSUE MANAGEMENT POLICIES
-- =================================================================

-- Issues: Direct organization isolation
CREATE POLICY "issues_organization_isolation" ON issues
  FOR ALL TO authenticated
  USING (auth.jwt() IS NULL OR "organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Priorities: Organization-scoped issue priorities
CREATE POLICY "priorities_organization_isolation" ON priorities
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Issue Statuses: Organization-scoped status definitions
CREATE POLICY "issue_statuses_organization_isolation" ON "issueStatuses"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Comments: Organization isolation via issue relationship
CREATE POLICY "comments_organization_isolation" ON comments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = comments."issueId"
      AND issues."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- Attachments: Direct organization isolation
CREATE POLICY "attachments_organization_isolation" ON attachments
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Issue History: Direct organization isolation
CREATE POLICY "issue_history_organization_isolation" ON "issueHistory"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Upvotes: Organization isolation via issue relationship
CREATE POLICY "upvotes_organization_isolation" ON upvotes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = upvotes."issueId"
      AND issues."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- =================================================================
-- 6. COLLECTION MANAGEMENT POLICIES (COMPLEX INHERITANCE)
-- =================================================================

-- Collection Types: Direct organization isolation
CREATE POLICY "collection_types_organization_isolation" ON "collectionTypes"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- Collections: Inherit organization from location
-- This is a complex inheritance pattern where collections don't have
-- direct organizationId but inherit it from their location
CREATE POLICY "collections_organization_isolation" ON collections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = collections."locationId"
      AND locations."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- Collection Machines: Double inheritance via collection -> location
-- Even more complex: collection_machines inherit org through collection -> location
CREATE POLICY "collection_machines_organization_isolation" ON "collection_machines"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      JOIN locations l ON l.id = c."locationId"
      WHERE c.id = "collection_machines"."collection_id"
      AND l."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text
    )
  );

-- =================================================================
-- 7. NOTIFICATION AND CONFIGURATION POLICIES
-- =================================================================

-- Notifications: Direct organization isolation (assuming organizationId column exists)
CREATE POLICY "notifications_organization_isolation" ON notifications
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- PinballMap Configs: Direct organization isolation
CREATE POLICY "pinball_map_configs_organization_isolation" ON "pinballMapConfigs"
  FOR ALL TO authenticated
  USING ("organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text);

-- =================================================================
-- 8. AUTOMATIC ORGANIZATION INJECTION FUNCTION
-- =================================================================

-- Function to automatically set organizationId on INSERT operations
-- This eliminates the need for manual organizationId assignment in application code
CREATE OR REPLACE FUNCTION set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract organizationId from JWT app_metadata
  NEW."organizationId" = (auth.jwt() ->> 'app_metadata' ->> 'organizationId')::text;
  
  -- Validate that organizationId was successfully extracted
  IF NEW."organizationId" IS NULL THEN
    RAISE EXCEPTION 'User does not have organization context in app_metadata';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- 9. ORGANIZATION INJECTION TRIGGERS
-- =================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_locations_organization_id ON locations;
DROP TRIGGER IF EXISTS set_machines_organization_id ON machines;
DROP TRIGGER IF EXISTS set_issues_organization_id ON issues;
DROP TRIGGER IF EXISTS set_priorities_organization_id ON priorities;
DROP TRIGGER IF EXISTS set_issue_statuses_organization_id ON "issueStatuses";
DROP TRIGGER IF EXISTS set_attachments_organization_id ON attachments;
DROP TRIGGER IF EXISTS set_issue_history_organization_id ON "issueHistory";
DROP TRIGGER IF EXISTS set_collection_types_organization_id ON "collectionTypes";
DROP TRIGGER IF EXISTS set_notifications_organization_id ON notifications;
DROP TRIGGER IF EXISTS set_pinball_map_configs_organization_id ON "pinballMapConfigs";
DROP TRIGGER IF EXISTS set_roles_organization_id ON roles;
DROP TRIGGER IF EXISTS set_memberships_organization_id ON memberships;

-- Core organizational triggers
CREATE TRIGGER set_roles_organization_id
  BEFORE INSERT ON roles FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_memberships_organization_id
  BEFORE INSERT ON memberships FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Location and machine triggers
CREATE TRIGGER set_locations_organization_id
  BEFORE INSERT ON locations FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_machines_organization_id
  BEFORE INSERT ON machines FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Issue management triggers
CREATE TRIGGER set_issues_organization_id
  BEFORE INSERT ON issues FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_priorities_organization_id
  BEFORE INSERT ON priorities FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issue_statuses_organization_id
  BEFORE INSERT ON "issueStatuses" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_attachments_organization_id
  BEFORE INSERT ON attachments FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_issue_history_organization_id
  BEFORE INSERT ON "issueHistory" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Collection management triggers
CREATE TRIGGER set_collection_types_organization_id
  BEFORE INSERT ON "collectionTypes" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- Notification and configuration triggers
CREATE TRIGGER set_notifications_organization_id
  BEFORE INSERT ON notifications FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

CREATE TRIGGER set_pinball_map_configs_organization_id
  BEFORE INSERT ON "pinballMapConfigs" FOR EACH ROW
  EXECUTE FUNCTION set_organization_id();

-- =================================================================
-- 10. PERFORMANCE INDEXES OPTIMIZED FOR RLS
-- =================================================================

-- Drop existing indexes if they exist
DROP INDEX CONCURRENTLY IF EXISTS issues_org_id_created_at_idx;
DROP INDEX CONCURRENTLY IF EXISTS machines_org_id_location_idx;
DROP INDEX CONCURRENTLY IF EXISTS comments_org_id_issue_idx;
DROP INDEX CONCURRENTLY IF EXISTS issues_org_status_priority_idx;
DROP INDEX CONCURRENTLY IF EXISTS machines_org_model_location_idx;
DROP INDEX CONCURRENTLY IF EXISTS locations_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS memberships_org_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS roles_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS priorities_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS issue_statuses_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS attachments_org_issue_idx;
DROP INDEX CONCURRENTLY IF EXISTS issue_history_org_issue_idx;
DROP INDEX CONCURRENTLY IF EXISTS collection_types_org_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS notifications_org_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS collections_location_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS collection_machines_collection_id_idx;

-- Core organizational indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS memberships_org_user_idx
  ON memberships ("organizationId", "userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS roles_org_id_idx
  ON roles ("organizationId", "name");

-- Location and machine indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS locations_org_id_idx
  ON locations ("organizationId", "name");

CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_org_id_location_idx
  ON machines ("organizationId", "locationId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_org_model_location_idx
  ON machines ("organizationId", "modelId", "locationId");

-- Issue management indexes (high-performance for common queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_org_id_created_at_idx
  ON issues ("organizationId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_org_status_priority_idx
  ON issues ("organizationId", "statusId", "priorityId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS priorities_org_id_idx
  ON priorities ("organizationId", "order");

CREATE INDEX CONCURRENTLY IF NOT EXISTS issue_statuses_org_id_idx
  ON "issueStatuses" ("organizationId", "order");

-- Comment and interaction indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_org_id_issue_idx
  ON comments ("issueId", "createdAt") WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS attachments_org_issue_idx
  ON attachments ("organizationId", "issueId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS issue_history_org_issue_idx
  ON "issueHistory" ("organizationId", "issueId", "createdAt");

-- Collection management indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS collection_types_org_id_idx
  ON "collectionTypes" ("organizationId", "name");

-- Inheritance-based indexes for complex policies
CREATE INDEX CONCURRENTLY IF NOT EXISTS collections_location_id_idx
  ON collections ("locationId", "typeId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS collection_machines_collection_id_idx
  ON "collectionMachines" ("collectionId", "machineId");

-- Notification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_org_user_idx
  ON notifications ("organizationId", "userId", "createdAt" DESC);

-- =================================================================
-- 11. VALIDATION QUERIES
-- =================================================================

-- These queries can be used to validate RLS setup
-- They should return 0 rows for cross-organization access attempts

/*
-- Test organization isolation (should return 0 for cross-org access)
SELECT COUNT(*) FROM issues WHERE "organizationId" != 'current-user-org-id';

-- Test complex inheritance (collections should only show from user's org locations)
SELECT COUNT(*) FROM collections c
JOIN locations l ON l.id = c."locationId"
WHERE l."organizationId" != 'current-user-org-id';

-- Test automatic organization injection
INSERT INTO issues (title, "machineId") VALUES ('Test Issue', 'some-machine-id');
-- Should automatically set organizationId from auth context
*/

-- =================================================================
-- SETUP COMPLETE
-- =================================================================

-- Log successful completion
DO $$
BEGIN
  RAISE NOTICE 'RLS setup completed successfully!';
  RAISE NOTICE 'Enabled RLS on % tables', (
    SELECT COUNT(*)
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    AND c.relrowsecurity = true
  );
  RAISE NOTICE 'Created % policies', (
    SELECT COUNT(*)
    FROM pg_policies
    WHERE schemaname = 'public'
  );
  RAISE NOTICE 'Created % triggers for automatic organization injection', (
    SELECT COUNT(*)
    FROM pg_trigger
    WHERE tgname LIKE 'set_%_organization_id'
  );
END $$;