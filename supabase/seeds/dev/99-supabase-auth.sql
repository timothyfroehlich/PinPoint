-- DEVELOPMENT SEED (Local Dev Only) — DO NOT USE IN PROD
-- Supabase-specific storage bucket and test auth users for local development.

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
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
-- AUTH USERS: Create auth.users entries for test users
-- =============================================================================
-- Insert corresponding auth.users for the test users (Supabase-specific)
-- These must match the user IDs in 03-users.sql

INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, is_super_admin, role)
VALUES 
  (
    '10000000-0000-4000-8000-000000000001', 
    '00000000-0000-0000-0000-000000000000',
    'tim.froehlich@example.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    now(), 
    now(),
    '{"name": "Tim Froehlich", "organizationId": "test-org-pinpoint"}'::jsonb,
    false,
    'authenticated'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 
    '00000000-0000-0000-0000-000000000000',
    'harry.williams@example.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    now(), 
    now(),
    '{"name": "Harry Williams", "organizationId": "test-org-pinpoint"}'::jsonb,
    false,
    'authenticated'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 
    '00000000-0000-0000-0000-000000000000',
    'escher.lefkoff@example.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    now(), 
    now(),
    '{"name": "Escher Lefkoff", "organizationId": "test-org-pinpoint"}'::jsonb,
    false,
    'authenticated'
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;
