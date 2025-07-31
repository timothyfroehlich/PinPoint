-- PinPoint Supabase Infrastructure Setup
-- This file sets up basic Supabase infrastructure for local development

-- Create the pinpoint-storage bucket for file uploads
-- Note: Storage policies will be added separately when storage features are implemented
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