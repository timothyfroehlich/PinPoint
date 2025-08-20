-- =================================================================
-- PinPoint Local Development RLS Setup
-- =================================================================
-- 
-- Simplified RLS setup for local development that just enables RLS
-- but allows all authenticated access. This lets us test the router
-- conversion without complex JWT parsing.
--
-- For production, use setup-rls.sql with proper Supabase auth.
-- =================================================================

-- =================================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- =================================================================

-- Core organizational tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE "issueHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE upvotes ENABLE ROW LEVEL SECURITY;

-- Collection management
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collectionTypes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_machines" ENABLE ROW LEVEL SECURITY;

-- Notification system
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- PinballMap integration
ALTER TABLE "pinballMapConfigs" ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. LOCAL DEVELOPMENT POLICIES (ALLOW ALL)
-- =================================================================

-- For local development, create simple policies that allow all authenticated access
-- This enables RLS without the complexity of JWT parsing

-- Organizations
CREATE POLICY "local_dev_allow_all" ON organizations
  FOR ALL TO authenticated
  USING (true);

-- Memberships
CREATE POLICY "local_dev_allow_all" ON memberships
  FOR ALL TO authenticated
  USING (true);

-- Roles
CREATE POLICY "local_dev_allow_all" ON roles
  FOR ALL TO authenticated
  USING (true);

-- Locations
CREATE POLICY "local_dev_allow_all" ON locations
  FOR ALL TO authenticated
  USING (true);

-- Machines
CREATE POLICY "local_dev_allow_all" ON machines
  FOR ALL TO authenticated
  USING (true);

-- Issues
CREATE POLICY "local_dev_allow_all" ON issues
  FOR ALL TO authenticated
  USING (true);

-- Priorities
CREATE POLICY "local_dev_allow_all" ON priorities
  FOR ALL TO authenticated
  USING (true);

-- Issue Statuses
CREATE POLICY "local_dev_allow_all" ON "issue_statuses"
  FOR ALL TO authenticated
  USING (true);

-- Comments
CREATE POLICY "local_dev_allow_all" ON comments
  FOR ALL TO authenticated
  USING (true);

-- Attachments
CREATE POLICY "local_dev_allow_all" ON attachments
  FOR ALL TO authenticated
  USING (true);

-- Issue History
CREATE POLICY "local_dev_allow_all" ON "issueHistory"
  FOR ALL TO authenticated
  USING (true);

-- Upvotes
CREATE POLICY "local_dev_allow_all" ON upvotes
  FOR ALL TO authenticated
  USING (true);

-- Collections
CREATE POLICY "local_dev_allow_all" ON collections
  FOR ALL TO authenticated
  USING (true);

-- Collection Types
CREATE POLICY "local_dev_allow_all" ON "collectionTypes"
  FOR ALL TO authenticated
  USING (true);

-- Collection Machines
CREATE POLICY "local_dev_allow_all" ON "collection_machines"
  FOR ALL TO authenticated
  USING (true);

-- Notifications
CREATE POLICY "local_dev_allow_all" ON notifications
  FOR ALL TO authenticated
  USING (true);

-- PinballMap Configs
CREATE POLICY "local_dev_allow_all" ON "pinballMapConfigs"
  FOR ALL TO authenticated
  USING (true);

-- =================================================================
-- 3. SUMMARY
-- =================================================================
-- RLS is now enabled on all multi-tenant tables but with permissive
-- local development policies. This allows testing router conversion
-- without manual organizationId filtering while maintaining the
-- RLS infrastructure for production deployment.