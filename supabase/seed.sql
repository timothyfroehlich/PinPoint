-- PinPoint Supabase Storage RLS Policies
-- This file sets up Row Level Security policies for the pinpoint-storage bucket

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create the pinpoint-storage bucket if it doesn't exist
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

-- Policy: Public read access for all files in pinpoint-storage bucket
-- This allows displaying images without authentication
CREATE POLICY "Public read access for pinpoint-storage"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pinpoint-storage');

-- Policy: Users can upload and manage their own avatar files
-- Path pattern: avatars/{user_id}/avatar.webp
CREATE POLICY "Users can manage own avatar"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Organization members can manage organization logos
-- Path pattern: organizations/{org_subdomain}/logo.webp
-- Note: This policy will need to be refined when we implement proper organization membership checks
CREATE POLICY "Organization members can manage logos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'organizations'
  -- TODO: Add organization membership check when RLS migration is complete
  -- AND user_has_org_permission(auth.uid(), (storage.foldername(name))[2], 'manage')
)
WITH CHECK (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'organizations'
  -- TODO: Add organization membership check when RLS migration is complete
  -- AND user_has_org_permission(auth.uid(), (storage.foldername(name))[2], 'manage')
);

-- Policy: Issue attachments can be managed by organization members
-- Path pattern: issues/{org_id}/{issue_id}/{filename}
-- Note: This is prepared for future issue attachment support
CREATE POLICY "Organization members can manage issue attachments"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'issues'
  -- TODO: Add organization membership check when RLS migration is complete
  -- AND user_has_org_permission(auth.uid(), (storage.foldername(name))[2], 'read')
)
WITH CHECK (
  bucket_id = 'pinpoint-storage' AND
  (storage.foldername(name))[1] = 'issues'
  -- TODO: Add organization membership check when RLS migration is complete
  -- AND user_has_org_permission(auth.uid(), (storage.foldername(name))[2], 'write')
);

-- Note: Additional policies can be added here as needed for other file types
-- such as machine backbox images, QR codes, etc.