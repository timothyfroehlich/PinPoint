-- =================================================================
-- PinPoint Row Level Security Policies (Single Source of Truth)
-- =================================================================


-- =================================================================
-- ROW LEVEL SECURITY POLICIES
-- =================================================================
-- Comprehensive RLS setup for multi-tenant architecture
-- 
-- Features:
-- - Organization-level isolation for all multi-tenant tables
-- - Session variable-based organization context (app.current_organization_id)
-- - Anonymous access for public data where appropriate
-- - Member validation through membership table joins
-- - Defense-in-depth with independent membership verification
-- - Author-only + moderator access controls for comments
--
-- This file is applied during database seeding and replaces the previous
-- TypeScript-based RLS setup system for consistency and maintainability.
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
-- 2. DROP ALL EXISTING POLICIES (Idempotent Setup)
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

-- Drop all existing policies (including any conflicting ones)
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
-- 2a. HELPER FUNCTIONS (Security Definer)
-- =================================================================

-- Organization membership check that bypasses RLS recursion
CREATE OR REPLACE FUNCTION fn_is_org_member(uid text, org_id text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = uid AND m.organization_id = org_id
  )
$$;

-- =================================================================
-- 3. ORGANIZATIONS - Public visibility, member-only management
-- =================================================================

-- Authenticated users can see their current organization (context-scoped)
CREATE POLICY "organizations_auth_read" ON organizations
  FOR SELECT TO authenticated
  USING (
    id = current_setting('app.current_organization_id', true)
  );

-- Anonymous users may read the current organization only (for policy evaluation)
CREATE POLICY "organizations_context_read" ON organizations
  FOR SELECT TO anon
  USING (
    id = current_setting('app.current_organization_id', true)
  );

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
  USING (
    id = auth.uid()::text
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    id = auth.uid()::text
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

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
  USING (
    user_id = auth.uid()::text
    AND organization_id = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    user_id = auth.uid()::text
    AND organization_id = current_setting('app.current_organization_id', true)
  );

-- Members can see other memberships in their organization
CREATE POLICY "memberships_org_member_read" ON memberships
  FOR SELECT TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- =================================================================
-- 6. CORE ORGANIZATIONAL DATA - Member access with public options
-- =================================================================

-- ROLES: Organization members can see org roles
CREATE POLICY "roles_member_access" ON roles
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- LOCATIONS: Public read access, member modify
-- Effective visibility helper functions
-- Location effective visibility: org private -> false; explicit FALSE -> false; TRUE -> true; NULL -> org.is_public
CREATE OR REPLACE FUNCTION fn_effective_location_public(loc_id text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN o.is_public = FALSE THEN FALSE
    WHEN l.is_public IS FALSE THEN FALSE
    WHEN l.is_public IS TRUE THEN TRUE
    ELSE o.is_public
  END
  FROM locations l
  JOIN organizations o ON o.id = l.organization_id
  WHERE l.id = loc_id
$$;

-- Machine effective visibility: consider org and location inheritance
CREATE OR REPLACE FUNCTION fn_effective_machine_public(machine_id text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN o.is_public = FALSE THEN FALSE
    WHEN l.is_public IS FALSE OR m.is_public IS FALSE THEN FALSE
    WHEN m.is_public IS TRUE OR l.is_public IS TRUE THEN TRUE
    ELSE o.is_public
  END
  FROM machines m
  JOIN locations l ON l.id = m.location_id
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.id = machine_id
$$;

-- Issue effective visibility: applies org public_issue_default when chain is all NULL
CREATE OR REPLACE FUNCTION fn_effective_issue_public(issue_id text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN o.is_public = FALSE THEN FALSE
    WHEN l.is_public IS FALSE OR m.is_public IS FALSE OR i.is_public IS FALSE THEN FALSE
    WHEN i.is_public IS TRUE OR m.is_public IS TRUE OR l.is_public IS TRUE THEN TRUE
    WHEN i.is_public IS NULL AND m.is_public IS NULL AND l.is_public IS NULL
      THEN (o.public_issue_default = 'public')
    ELSE o.is_public
  END
  FROM issues i
  JOIN machines m ON m.id = i.machine_id
  JOIN locations l ON l.id = m.location_id
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.id = issue_id
$$;

CREATE POLICY "locations_public_read" ON locations
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND (
      is_public IS TRUE
      OR (
        is_public IS NULL
        AND EXISTS (
          SELECT 1 FROM organizations o
          WHERE o.id = locations.organization_id AND o.is_public = TRUE
        )
      )
    )
  );

CREATE POLICY "locations_member_modify" ON locations
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- MACHINES: Public read access, member modify
CREATE POLICY "machines_public_read" ON machines
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = machines.organization_id
      AND (
        machines.is_public IS TRUE
        OR (
          machines.is_public IS NULL AND EXISTS (
            SELECT 1 FROM locations l
            WHERE l.id = machines.location_id
            AND (
              l.is_public IS TRUE
              OR (l.is_public IS NULL AND o.is_public = TRUE)
            )
          )
        )
      )
    )
  );

CREATE POLICY "machines_member_all_access" ON machines
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
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
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = organization_id
      AND o.allow_anonymous_issues = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM machines m
      WHERE m.id = issues.machine_id
      AND m.deleted_at IS NULL
    )
  );

-- Anonymous users can read public issues
CREATE POLICY "issues_public_read" ON issues
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = issues.organization_id
      AND (
        issues.is_public IS TRUE
        OR (
          issues.is_public IS NULL AND EXISTS (
            SELECT 1 FROM machines m
            WHERE m.id = issues.machine_id
            AND (
              m.is_public IS TRUE
              OR (
                m.is_public IS NULL AND EXISTS (
                  SELECT 1 FROM locations l
                  WHERE l.id = m.location_id
                  AND (
                    l.is_public IS TRUE
                    OR (l.is_public IS NULL AND o.is_public = TRUE)
                  )
                )
              )
            )
          )
        )
      )
    )
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
    AND EXISTS (
      SELECT 1 FROM machines mm
      WHERE mm.id = issues.machine_id
      AND mm.deleted_at IS NULL
    )
  );

-- ISSUE STATUSES AND PRIORITIES: Member access only
CREATE POLICY "issue_statuses_member_access" ON "issue_statuses"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

CREATE POLICY "priorities_member_access" ON priorities
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- =================================================================
-- 8. COMMENTS - Author-only + Moderator Access (SECURITY CRITICAL)
-- =================================================================
-- Fixed policies per RLS assertions §9.5:
-- - Author modify: only original author can update/delete their own comments
-- - Moderator override: users with comment:moderate can update/delete any comment in their org
-- - No permissive USING(true) policies that would override security
-- =================================================================

-- Anonymous users can create comments on public issues
CREATE POLICY "comments_anon_create_public" ON comments
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND fn_effective_issue_public(i.id)
    )
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = (
        SELECT i2.organization_id FROM issues i2 WHERE i2.id = issue_id
      )
      AND o.allow_anonymous_comments = TRUE
    )
    AND commenter_type = 'anonymous'
    AND author_id IS NULL
  );

-- Members: read comments in their org  
CREATE POLICY "comments_member_read" ON comments
  FOR SELECT TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
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

-- Members: create comments in their org
CREATE POLICY "comments_member_insert" ON comments
  FOR INSERT TO authenticated
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

-- CRITICAL: Authors can ONLY update their own comments (no cross-user access)
CREATE POLICY "comments_author_update" ON comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()::text
    AND organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- CRITICAL: Authors can ONLY delete their own comments (no cross-user access)  
CREATE POLICY "comments_author_delete" ON comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()::text
    AND organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- CRITICAL: Moderators can update any comment ONLY with explicit comment:moderate permission
CREATE POLICY "comments_moderate_update" ON comments
  FOR UPDATE TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1
      FROM memberships m
      JOIN roles r ON r.id = m.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
      AND p.name = 'comment:moderate'
    )
    AND EXISTS (
      SELECT 1 FROM issues i WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- CRITICAL: Moderators can delete any comment ONLY with explicit comment:moderate permission
CREATE POLICY "comments_moderate_delete" ON comments
  FOR DELETE TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1
      FROM memberships m
      JOIN roles r ON r.id = m.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE m.user_id = auth.uid()::text
      AND m.organization_id = current_setting('app.current_organization_id', true)
      AND p.name = 'comment:moderate'
    )
    AND EXISTS (
      SELECT 1 FROM issues i WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
    )
  );

-- Public read: guests and authenticated non-members can read comments for public issues
CREATE POLICY "comments_public_read" ON comments
  FOR SELECT TO anon, authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND fn_effective_issue_public(i.id)
    )
  );

-- Authenticated guests: create on public issues they can access
CREATE POLICY "comments_auth_create_public" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM issues i
      WHERE i.id = issue_id
      AND i.organization_id = current_setting('app.current_organization_id', true)
      AND fn_effective_issue_public(i.id)
    )
    AND commenter_type = 'authenticated'
    AND author_id = auth.uid()::text
  );

-- =================================================================
-- 9. NOTIFICATIONS - User-specific access only
-- =================================================================

CREATE POLICY "notifications_user_access" ON notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- =================================================================
-- 10. REFERENCE DATA - Global read access
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
-- 11. COLLECTION SYSTEM - Member access only
-- =================================================================

CREATE POLICY "collections_member_access" ON collections
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

CREATE POLICY "collection_types_member_access" ON "collection_types"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- =================================================================
-- 12. CONFIGURATION - Member access only
-- =================================================================

CREATE POLICY "pinball_map_configs_member_access" ON "pinball_map_configs"
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- =================================================================
-- 13. ANONYMOUS RATE LIMITS - Organization-scoped tracking
-- =================================================================

-- Only members can view/manage rate limits for their organization
CREATE POLICY "anonymous_rate_limits_member_access" ON anonymous_rate_limits
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
    AND fn_is_org_member(auth.uid()::text, current_setting('app.current_organization_id', true))
  );

-- System can insert rate limit records (for tracking anonymous actions)
CREATE POLICY "anonymous_rate_limits_system_insert" ON anonymous_rate_limits
  FOR INSERT TO anon
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id', true)
  );

-- =================================================================
-- 14. INVARIANTS & TRIGGERS (Organization Chain Enforcement)
-- =================================================================

-- Machines: organization_id must match location.organization_id
CREATE OR REPLACE FUNCTION enforce_machine_org_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  loc_org text;
BEGIN
  SELECT organization_id INTO loc_org FROM locations WHERE id = NEW.location_id;
  IF loc_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid location_id for machine';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM loc_org THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'machines.organization_id must equal locations.organization_id';
  END IF;
  -- Prevent direct organization_id changes
  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Direct update of machines.organization_id is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_machine_org_chain ON machines;
CREATE TRIGGER trg_enforce_machine_org_chain
  BEFORE INSERT OR UPDATE ON machines
  FOR EACH ROW
  EXECUTE FUNCTION enforce_machine_org_chain();

-- Issues: organization_id must match machine.organization_id
CREATE OR REPLACE FUNCTION enforce_issue_org_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mach_org text;
BEGIN
  SELECT organization_id INTO mach_org FROM machines WHERE id = NEW.machine_id;
  IF mach_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid machine_id for issue';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM mach_org THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'issues.organization_id must equal machines.organization_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_issue_org_chain ON issues;
CREATE TRIGGER trg_enforce_issue_org_chain
  BEFORE INSERT OR UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION enforce_issue_org_chain();

-- Comments: organization_id must match issue.organization_id
CREATE OR REPLACE FUNCTION enforce_comment_org_chain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  issue_org text;
BEGIN
  SELECT organization_id INTO issue_org FROM issues WHERE id = NEW.issue_id;
  IF issue_org IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Invalid issue_id for comment';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM issue_org THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'comments.organization_id must equal issues.organization_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_comment_org_chain ON comments;
CREATE TRIGGER trg_enforce_comment_org_chain
  BEFORE INSERT OR UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_comment_org_chain();

-- =================================================================
-- 15. PUBLIC ORGANIZATIONS MINIMAL (Anon-safe listing)
-- =================================================================

-- Function returns minimal public org fields; runs as table owner
CREATE OR REPLACE FUNCTION fn_public_organizations_minimal()
RETURNS TABLE (id text, name text, subdomain text, logo_url text)
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, subdomain, logo_url
  FROM organizations
  WHERE is_public = TRUE
  ORDER BY name ASC
$$;

-- View for convenient SELECT access (does not bypass function security)
DROP VIEW IF EXISTS public_organizations_minimal;
CREATE VIEW public_organizations_minimal WITH (security_barrier=true) AS
  SELECT * FROM fn_public_organizations_minimal();

-- Grants for anonymous and authenticated access
GRANT EXECUTE ON FUNCTION fn_public_organizations_minimal() TO anon, authenticated;
GRANT SELECT ON public_organizations_minimal TO anon, authenticated;

-- =================================================================
-- 16. VERIFICATION QUERIES
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