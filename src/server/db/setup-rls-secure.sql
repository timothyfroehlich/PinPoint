-- =================================================================
-- PinPoint Secure RLS Setup - Organization-Agnostic Architecture
-- =================================================================
-- 
-- Implements proper multi-tenant RLS policies with:
-- - Session variable-based organization context (no JWT dependencies)
-- - Anonymous access for public data
-- - Member validation through membership table joins
-- - Defense-in-depth with independent membership verification
-- =================================================================

-- =================================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- =================================================================

-- Core organizational tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Location and machine management
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Issue management system
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_statuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- Collection management
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_machines" ENABLE ROW LEVEL SECURITY;

-- Notification system
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PinballMap integration
ALTER TABLE "pinball_map_configs" ENABLE ROW LEVEL SECURITY;

-- Anonymous access support
ALTER TABLE anonymous_rate_limits ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. DROP ALL EXISTING POLICIES
-- =================================================================

-- Helper function to drop all policies for a table
CREATE OR REPLACE FUNCTION drop_all_policies(table_name text) 
RETURNS void AS $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = table_name
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop all existing policies
SELECT drop_all_policies('organizations');
SELECT drop_all_policies('users');
SELECT drop_all_policies('memberships');
SELECT drop_all_policies('roles');
SELECT drop_all_policies('locations');
SELECT drop_all_policies('machines');
SELECT drop_all_policies('issues');
SELECT drop_all_policies('priorities');
SELECT drop_all_policies('issue_statuses');
SELECT drop_all_policies('comments');
SELECT drop_all_policies('attachments');
SELECT drop_all_policies('issue_history');
SELECT drop_all_policies('upvotes');
SELECT drop_all_policies('collections');
SELECT drop_all_policies('collection_types');
SELECT drop_all_policies('collection_machines');
SELECT drop_all_policies('notifications');
SELECT drop_all_policies('pinball_map_configs');
SELECT drop_all_policies('anonymous_rate_limits');
SELECT drop_all_policies('permissions');
SELECT drop_all_policies('models');

-- Clean up helper function
DROP FUNCTION drop_all_policies(text);

-- =================================================================
-- 3. ORGANIZATIONS - Public visibility, member-only management
-- =================================================================

-- Anonymous users can see organizations (for subdomain resolution)
CREATE POLICY "organizations_public_read" ON organizations
  FOR SELECT TO anon
  USING (true);

-- Authenticated users can see all organizations (for navigation, etc.)
CREATE POLICY "organizations_auth_read" ON organizations
  FOR SELECT TO authenticated
  USING (true);

-- Only members can modify their organization
CREATE POLICY "organizations_member_modify" ON organizations
  FOR ALL TO authenticated
  USING (
    id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- =================================================================
-- 4. USERS - Privacy-focused access
-- =================================================================

-- Users can only see themselves
CREATE POLICY "users_self_access" ON users
  FOR ALL TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Anonymous users cannot access user data
CREATE POLICY "users_no_anon_access" ON users
  FOR ALL TO anon
  USING (false);

-- =================================================================
-- 5. MEMBERSHIPS - Organization-scoped with self-access
-- =================================================================

-- Users can see their own memberships
CREATE POLICY "memberships_self_access" ON memberships
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Members can see other memberships in their organization
CREATE POLICY "memberships_org_member_read" ON memberships
  FOR SELECT TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- =================================================================
-- 6. CORE ORGANIZATIONAL DATA - Member access with public options
-- =================================================================

-- ROLES: Organization members can see org roles
CREATE POLICY "roles_member_access" ON roles
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- LOCATIONS: Public read access, member modify
CREATE POLICY "locations_public_read" ON locations
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND (is_public = true OR is_public IS NULL) -- Default to public
  );

CREATE POLICY "locations_member_modify" ON locations
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- MACHINES: Public read access, member modify
CREATE POLICY "machines_public_read" ON machines
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND (is_public = true OR is_public IS NULL) -- Default to public
  );

CREATE POLICY "machines_member_all_access" ON machines
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- =================================================================
-- 7. ISSUES SYSTEM - Anonymous reporting, member management
-- =================================================================

-- Anonymous users can create issues (for QR code reporting)
CREATE POLICY "issues_anon_create" ON issues
  FOR INSERT TO anon
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND reporter_type = 'anonymous'
    AND created_by_id IS NULL
  );

-- Anonymous users can read public issues
CREATE POLICY "issues_public_read" ON issues
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND (is_public = true OR is_public IS NULL)
  );

-- Members have full access to all issues in their organization
CREATE POLICY "issues_member_access" ON issues
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- ISSUE STATUSES AND PRIORITIES: Member access only
CREATE POLICY "issue_statuses_member_access" ON "issue_statuses"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "priorities_member_access" ON priorities
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- COMMENTS: Anonymous can create on public issues, members see all
CREATE POLICY "comments_anon_create_public" ON comments
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND (i.is_public = true OR i.is_public IS NULL)
    )
    AND commenter_type = 'anonymous'
    AND author_id IS NULL
  );

CREATE POLICY "comments_member_access" ON comments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()::text
        AND m.organization_id = current_setting('app.current_organization_id', true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid()::text
        AND m.organization_id = current_setting('app.current_organization_id', true)
      )
    )
  );

-- =================================================================
-- 8. NOTIFICATIONS - User-specific access only
-- =================================================================

CREATE POLICY "notifications_user_access" ON notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- =================================================================
-- 9. REFERENCE DATA - Global read access
-- =================================================================

-- PERMISSIONS: Global read for permission checking
CREATE POLICY "permissions_global_read" ON permissions
  FOR SELECT TO authenticated
  USING (true);

-- MODELS: Global read for machine model reference
CREATE POLICY "models_global_read" ON models
  FOR SELECT TO anon, authenticated
  USING (true);

-- =================================================================
-- 10. COLLECTION SYSTEM - Member access only
-- =================================================================

CREATE POLICY "collections_member_access" ON collections
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

CREATE POLICY "collection_types_member_access" ON "collection_types"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- =================================================================
-- 11. CONFIGURATION - Member access only
-- =================================================================

CREATE POLICY "pinball_map_configs_member_access" ON "pinball_map_configs"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- =================================================================
-- 12. ANONYMOUS RATE LIMITS - Organization-scoped tracking
-- =================================================================

-- Only members can view/manage rate limits for their organization
CREATE POLICY "anonymous_rate_limits_member_access" ON anonymous_rate_limits
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- System can insert rate limit records (for tracking anonymous actions)
CREATE POLICY "anonymous_rate_limits_system_insert" ON anonymous_rate_limits
  FOR INSERT TO anon
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
  );

-- =================================================================
-- 13. VERIFICATION QUERIES
-- =================================================================

-- Count policies created
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
AND c.relrowsecurity = true
ORDER BY tablename;