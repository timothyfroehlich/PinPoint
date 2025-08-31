-- PinPoint Metadata Seeding  
-- Organization-specific configuration: priorities, statuses, collection types
-- Universal PostgreSQL - works in any PostgreSQL environment

-- =============================================================================
-- PRIORITIES: Create priority levels for both organizations
-- =============================================================================
INSERT INTO priorities (id, name, "order", organization_id) VALUES
  -- Primary organization priorities
  ('priority-low-primary-001', 'Low', 1, 'test-org-pinpoint'),
  ('priority-medium-primary-001', 'Medium', 2, 'test-org-pinpoint'),
  ('priority-high-primary-001', 'High', 3, 'test-org-pinpoint'),
  ('priority-critical-primary-001', 'Critical', 4, 'test-org-pinpoint'),
  -- Competitor organization priorities
  ('priority-low-competitor-001', 'Low', 1, 'test-org-competitor'),
  ('priority-medium-competitor-001', 'Medium', 2, 'test-org-competitor'),
  ('priority-high-competitor-001', 'High', 3, 'test-org-competitor'),
  ('priority-critical-competitor-001', 'Critical', 4, 'test-org-competitor')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "order" = EXCLUDED."order",
  organization_id = EXCLUDED.organization_id;

-- =============================================================================
-- ISSUE STATUSES: Create status levels for both organizations
-- =============================================================================
INSERT INTO issue_statuses (id, name, category, organization_id) VALUES
  -- Primary organization statuses
  ('status-new-primary-001', 'New', 'NEW', 'test-org-pinpoint'),
  ('status-in-progress-primary-001', 'In Progress', 'IN_PROGRESS', 'test-org-pinpoint'),
  ('status-needs-expert-primary-001', 'Needs Expert', 'IN_PROGRESS', 'test-org-pinpoint'),
  ('status-needs-parts-primary-001', 'Needs Parts', 'IN_PROGRESS', 'test-org-pinpoint'),
  ('status-fixed-primary-001', 'Fixed', 'RESOLVED', 'test-org-pinpoint'),
  ('status-not-to-be-fixed-primary-001', 'Not to be Fixed', 'RESOLVED', 'test-org-pinpoint'),
  ('status-not-reproducible-primary-001', 'Not Reproducible', 'RESOLVED', 'test-org-pinpoint'),
  -- Competitor organization statuses
  ('status-new-competitor-001', 'New', 'NEW', 'test-org-competitor'),
  ('status-in-progress-competitor-001', 'In Progress', 'IN_PROGRESS', 'test-org-competitor'),
  ('status-needs-expert-competitor-001', 'Needs Expert', 'IN_PROGRESS', 'test-org-competitor'),
  ('status-needs-parts-competitor-001', 'Needs Parts', 'IN_PROGRESS', 'test-org-competitor'),
  ('status-fixed-competitor-001', 'Fixed', 'RESOLVED', 'test-org-competitor'),
  ('status-not-to-be-fixed-competitor-001', 'Not to be Fixed', 'RESOLVED', 'test-org-competitor'),
  ('status-not-reproducible-competitor-001', 'Not Reproducible', 'RESOLVED', 'test-org-competitor')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  organization_id = EXCLUDED.organization_id;

-- =============================================================================
-- COLLECTION TYPES: Create collection types for both organizations
-- =============================================================================
INSERT INTO collection_types (id, name, organization_id) VALUES
  -- Primary organization collection types
  ('collection-rooms-primary-001', 'Rooms', 'test-org-pinpoint'),
  ('collection-manufacturer-primary-001', 'Manufacturer', 'test-org-pinpoint'),
  ('collection-era-primary-001', 'Era', 'test-org-pinpoint'),
  -- Competitor organization collection types
  ('collection-rooms-competitor-001', 'Rooms', 'test-org-competitor'),
  ('collection-manufacturer-competitor-001', 'Manufacturer', 'test-org-competitor'),
  ('collection-era-competitor-001', 'Era', 'test-org-competitor')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  organization_id = EXCLUDED.organization_id;