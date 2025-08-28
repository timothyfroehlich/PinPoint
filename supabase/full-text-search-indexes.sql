-- Full-text search indexes for Phase 3C Universal Search
-- PostgreSQL GIN indexes for optimized text search performance

-- Issues table - search across title, description, and consistency
CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_fts_idx 
ON issues 
USING gin(to_tsvector('english', 
  coalesce(title, '') || ' ' || 
  coalesce(description, '') || ' ' || 
  coalesce(consistency, '')
));

-- Comments table - search across content for issue-related searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_fts_idx 
ON comments 
USING gin(to_tsvector('english', coalesce(content, '')));

-- Machines table - search across machine names
CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_fts_idx 
ON machines 
USING gin(to_tsvector('english', coalesce(name, '')));

-- Models table - search across model names and manufacturers
CREATE INDEX CONCURRENTLY IF NOT EXISTS models_fts_idx 
ON models 
USING gin(to_tsvector('english', 
  coalesce(name, '') || ' ' || 
  coalesce(manufacturer, '')
));

-- Locations table - search across names, descriptions, and cities
CREATE INDEX CONCURRENTLY IF NOT EXISTS locations_fts_idx 
ON locations 
USING gin(to_tsvector('english', 
  coalesce(name, '') || ' ' || 
  coalesce(description, '') || ' ' || 
  coalesce(city, '')
));

-- Users table - search across names, emails, and bios
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_fts_idx 
ON users 
USING gin(to_tsvector('english', 
  coalesce(name, '') || ' ' || 
  coalesce(email, '') || ' ' || 
  coalesce(bio, '')
));

-- Priorities table - search across priority names
CREATE INDEX CONCURRENTLY IF NOT EXISTS priorities_fts_idx 
ON priorities 
USING gin(to_tsvector('english', coalesce(name, '')));

-- Issue statuses table - search across status names
CREATE INDEX CONCURRENTLY IF NOT EXISTS issue_statuses_fts_idx 
ON issue_statuses 
USING gin(to_tsvector('english', coalesce(name, '')));

-- Additional indexes for search performance with organization scoping
-- Composite indexes for filtering by organization + search ranking

-- Issues with organization scoping for search
CREATE INDEX CONCURRENTLY IF NOT EXISTS issues_org_search_idx 
ON issues (organization_id, created_at DESC);

-- Machines with organization scoping for search
CREATE INDEX CONCURRENTLY IF NOT EXISTS machines_org_search_idx 
ON machines (organization_id, created_at DESC);

-- Users don't have organization_id directly, but we search via memberships
-- This index will help with user search in organization context
CREATE INDEX CONCURRENTLY IF NOT EXISTS memberships_user_org_idx 
ON memberships (organization_id, user_id);

-- Locations with organization scoping for search
CREATE INDEX CONCURRENTLY IF NOT EXISTS locations_org_search_idx 
ON locations (organization_id, created_at DESC);