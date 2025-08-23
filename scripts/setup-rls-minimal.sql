-- Minimal RLS Setup for Phase 2.5 Testing
-- This enables basic RLS policies for the pgTAP tests to validate

-- Enable RLS on core tables needed for testing
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "local_dev_allow_all" ON organizations;
DROP POLICY IF EXISTS "issues_organization_isolation" ON issues;
DROP POLICY IF EXISTS "machines_organization_isolation" ON machines;

-- Create basic organization isolation policy
CREATE POLICY "organizations_org_isolation" ON organizations
  FOR ALL TO authenticated
  USING (
    auth.jwt() IS NULL OR 
    id = (auth.jwt() -> 'app_metadata' ->> 'organizationId')
  );

-- Create basic issues isolation policy
CREATE POLICY "issues_organization_isolation" ON issues
  FOR ALL TO authenticated
  USING (
    auth.jwt() IS NULL OR
    "organizationId" = (auth.jwt() -> 'app_metadata' ->> 'organizationId')
  );

-- Create basic machines isolation policy  
CREATE POLICY "machines_organization_isolation" ON machines
  FOR ALL TO authenticated
  USING (
    auth.jwt() IS NULL OR
    "organizationId" = (auth.jwt() -> 'app_metadata' ->> 'organizationId')
  );

-- Allow anonymous users to see nothing (for testing)
CREATE POLICY "anon_no_access_orgs" ON organizations
  FOR ALL TO anon
  USING (false);

CREATE POLICY "anon_no_access_issues" ON issues  
  FOR ALL TO anon
  USING (false);

CREATE POLICY "anon_no_access_machines" ON machines
  FOR ALL TO anon
  USING (false);

-- Confirm RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('organizations', 'issues', 'machines') 
ORDER BY tablename;