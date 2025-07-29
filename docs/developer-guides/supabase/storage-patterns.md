# Supabase Storage Patterns

## Overview

Supabase Storage provides S3-compatible object storage with built-in CDN, image transformations, and access control. PinPoint uses it for issue attachments, user avatars, and organization logos.

## Storage Structure

```
pinpoint-storage/
├── avatars/
│   └── {userId}/
│       └── avatar.{ext}
├── organizations/
│   └── {organizationId}/
│       ├── logo.{ext}
│       └── machines/
│           └── {machineId}/
│               └── backbox.{ext}
└── issues/
    └── {organizationId}/
        └── {issueId}/
            └── {timestamp}-{filename}
```

## File Upload Patterns

### Basic File Upload

```typescript
import { createBrowserClient } from "@supabase/ssr";

async function uploadFile(
  file: File,
  bucket: string,
  path: string,
): Promise<string | null> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false, // Prevent overwriting
    });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  return data.path;
}
```

### Image Upload with Optimization

```typescript
async function uploadImage(
  file: File,
  bucket: string,
  path: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {},
): Promise<string | null> {
  // Client-side image optimization before upload
  const optimizedBlob = await optimizeImage(file, options);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, optimizedBlob, {
      contentType: "image/webp",
      cacheControl: "3600",
    });

  return data?.path ?? null;
}

async function optimizeImage(
  file: File,
  { maxWidth = 1920, maxHeight = 1080, quality = 0.8 },
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    img.onload = () => {
      // Calculate dimensions
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => resolve(blob!), "image/webp", quality);
    };

    img.src = URL.createObjectURL(file);
  });
}
```

## File Access Patterns

### Public URL Generation

```typescript
function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return data.publicUrl;
}

// With transformations
function getThumbnailUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, {
    transform: {
      width: 200,
      height: 200,
      resize: "cover",
      quality: 80,
    },
  });

  return data.publicUrl;
}
```

### Signed URLs for Private Files

```typescript
async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  return data?.signedUrl ?? null;
}
```

## Organization-Scoped Storage

### Issue Attachments

```typescript
export async function uploadIssueAttachment(
  issueId: string,
  organizationId: string,
  file: File,
): Promise<{ url: string; path: string } | null> {
  const timestamp = Date.now();
  const ext = file.name.split(".").pop();
  const filename = `${timestamp}-${sanitizeFilename(file.name)}`;
  const path = `issues/${organizationId}/${issueId}/${filename}`;

  const uploadedPath = await uploadFile(file, "pinpoint-storage", path);
  if (!uploadedPath) return null;

  const url = getPublicUrl("pinpoint-storage", uploadedPath);

  // Store reference in database
  await db.insert(attachments).values({
    issueId,
    filename: file.name,
    path: uploadedPath,
    url,
    size: file.size,
    mimeType: file.type,
  });

  return { url, path: uploadedPath };
}

function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}
```

### User Avatars

```typescript
export async function updateUserAvatar(
  userId: string,
  file: File,
): Promise<string | null> {
  const path = `avatars/${userId}/avatar.webp`;

  // Delete existing avatar if any
  await supabase.storage.from("pinpoint-storage").remove([path]);

  // Upload optimized avatar
  const uploaded = await uploadImage(file, "pinpoint-storage", path, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.9,
  });

  if (!uploaded) return null;

  const url = getPublicUrl("pinpoint-storage", uploaded);

  // Update user profile
  await db.update(users).set({ avatarUrl: url }).where(eq(users.id, userId));

  return url;
}
```

## Storage Policies

### RLS Policies for Storage

```sql
-- Public read for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'pinpoint-storage' AND name LIKE 'avatars/%');

-- Organization members can upload issue attachments
CREATE POLICY "Organization members can upload issue attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'pinpoint-storage'
  AND name LIKE 'issues/%'
  AND (storage.foldername(name))[2] = auth.jwt()->>'organizationId'
);

-- Users can update their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR ALL
USING (
  bucket_id = 'pinpoint-storage'
  AND name LIKE 'avatars/%'
  AND (storage.foldername(name))[2] = auth.uid()
);
```

## ⚠️ MIGRATION: Local Storage Patterns

### File Upload Migration

```typescript
// OLD: Local file storage
import { saveToLocalStorage } from "~/lib/image-storage/local-storage";

async function uploadIssueImage(file: File, issueId: string) {
  const result = await saveToLocalStorage(file, "issue", issueId);
  return {
    path: result.path,
    url: `/uploads/images/${result.filename}`,
  };
}

// NEW: Supabase storage
async function uploadIssueImage(file: File, issueId: string, orgId: string) {
  const path = `issues/${orgId}/${issueId}/${Date.now()}-${file.name}`;
  const uploaded = await uploadFile(file, "pinpoint-storage", path);
  return {
    path: uploaded,
    url: getPublicUrl("pinpoint-storage", uploaded),
  };
}
```

### Static File Serving

```typescript
// OLD: Next.js public folder
<Image src="/uploads/images/issue-123.jpg" />

// NEW: Supabase CDN
<Image src={getPublicUrl('pinpoint-storage', attachment.path)} />

// With optimization
<Image
  src={getThumbnailUrl('pinpoint-storage', attachment.path)}
  loading="lazy"
/>
```

## Best Practices

1. **Always Optimize Images**: Use WebP format and appropriate dimensions
2. **Organize by Tenant**: Include organizationId in paths for isolation
3. **Sanitize Filenames**: Prevent path traversal and special characters
4. **Set Cache Headers**: Use appropriate cache-control for performance
5. **Handle Errors**: Provide fallbacks for failed uploads/downloads

## Utilities

### File Type Validation

```typescript
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "text/plain"];

export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file: File, maxSizeInMB: number): boolean {
  return file.size <= maxSizeInMB * 1024 * 1024;
}
```

### Storage Cleanup

```typescript
export async function cleanupIssueAttachments(
  issueId: string,
  organizationId: string,
): Promise<void> {
  const prefix = `issues/${organizationId}/${issueId}/`;

  const { data: files } = await supabase.storage
    .from("pinpoint-storage")
    .list(prefix);

  if (files && files.length > 0) {
    const filePaths = files.map((f) => `${prefix}${f.name}`);
    await supabase.storage.from("pinpoint-storage").remove(filePaths);
  }
}
```

## Error Handling

```typescript
export async function safeUpload(
  file: File,
  bucket: string,
  path: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate file
    if (!validateFileType(file, ALLOWED_IMAGE_TYPES)) {
      return { success: false, error: "Invalid file type" };
    }

    if (!validateFileSize(file, 10)) {
      return { success: false, error: "File too large (max 10MB)" };
    }

    // Upload file
    const uploaded = await uploadImage(file, bucket, path);
    if (!uploaded) {
      return { success: false, error: "Upload failed" };
    }

    const url = getPublicUrl(bucket, uploaded);
    return { success: true, url };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```
