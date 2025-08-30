-- PinPoint Supabase Infrastructure Setup
-- Modern seeding architecture: SQL for infrastructure, TypeScript for dynamic data

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
  );
  RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SECURITY: Row Level Security preparation
-- =============================================================================
-- Note: RLS policies will be implemented in Stage 3 of migration
-- This ensures the infrastructure is ready

-- Enable RLS on key tables (no policies yet - tables must exist first)
-- These will be uncommented in Stage 3:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public."Issue" ENABLE ROW LEVEL SECURITY;

-- Add missing RLS policy for unauthenticated/default role access
-- This policy blocks all access for users who are not authenticated or anon
DO $$
BEGIN
  -- Only create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'default_no_access_users'
  ) THEN
    EXECUTE 'CREATE POLICY default_no_access_users ON public.users 
             FOR ALL TO public 
             USING (false)';
  END IF;
END $$;

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