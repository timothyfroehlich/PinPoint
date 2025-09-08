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
-- AUTH USERS: Dev users now created via Supabase Admin API
-- =============================================================================
-- Dev auth users are now created via scripts/create-dev-users.ts using the
-- Supabase Admin API, which properly handles password hashing and auth integration.
-- This approach is compatible with Supabase's authentication system.

-- =============================================================================
-- ADMIN HELPERS (DEV/PREVIEW ONLY): Bypass RLS for membership upserts
-- =============================================================================
-- SECURITY NOTE: These helpers are included only in DEV/PREVIEW seed file and
-- are not part of base production seeds. They use SECURITY DEFINER to safely
-- bypass RLS when invoked with appropriate privileges (e.g., service role).

-- Upsert a membership for a user/org/role, updating role if row exists
CREATE OR REPLACE FUNCTION public.fn_upsert_membership_admin(
  p_user_id text,
  p_org_id text,
  p_role_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_id text;
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL OR p_role_id IS NULL THEN
    RAISE EXCEPTION 'fn_upsert_membership_admin: all parameters are required';
  END IF;

  -- Deterministic ID for idempotency across runs
  v_id := 'membership-' || left(replace(p_org_id, ' ', ''), 16) || '-' || left(p_user_id, 8);

  SELECT EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = p_user_id AND m.organization_id = p_org_id
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE memberships
    SET role_id = p_role_id
    WHERE user_id = p_user_id AND organization_id = p_org_id;
  ELSE
    INSERT INTO memberships (id, user_id, organization_id, role_id)
    VALUES (v_id, p_user_id, p_org_id, p_role_id);
  END IF;
END;
$$;
