# Image Upload Feature - Superpowers Implementation Plan

## Goal

Implement image uploads for PinPoint issue reports with incremental feature PRs. Each PR delivers a complete, testable user-facing feature.

## Assumptions

- Vercel Blob free tier: 1 GB storage, 10 GB bandwidth/month
- Mobile-first: camera integration for phone uploads
- Limits: 2 images (public), 4 (auth), 10 max per issue
- Soft delete with 24-hour grace period
- Cropping optional but encouraged via UX

---

# PR 1: Basic Image Upload + Display (MVP)

**Branch**: `feature/image-upload-mvp`
**Goal**: Users can upload images on `/report` and see them on issue detail page

## Plan

### Step 1.1: Install Dependencies

- **Files**: `package.json`
- **Change**: `pnpm add @vercel/blob browser-image-compression`
  - Note: `react-easy-crop` deferred to PR 2
- **Verify**:
  ```bash
  grep -E "(vercel/blob|browser-image-compression)" package.json
  pnpm run typecheck
  ```

### Step 1.2: Database Migration

- **Files**: `supabase/migrations/YYYYMMDDHHMMSS_add_issue_images_table.sql`
- **Change**:
  - Create `issue_images` table: id, issue_id, comment_id, uploaded_by, full_image_url, cropped_image_url (nullable), full_blob_pathname, cropped_blob_pathname (nullable), file_size_bytes, mime_type, original_filename, deleted_at, deleted_by, created_at, updated_at
  - Indexes: issue_id, uploaded_by, deleted_at (partial)
  - RLS: view active (anyone), insert (auth), update/delete (owner or admin)
- **Verify**:
  ```bash
  pnpm run db:generate -- --name add_issue_images_table
  pnpm run db:migrate
  psql $DATABASE_URL -c "\d issue_images"
  ```

### Step 1.3: Drizzle Schema

- **Files**: `src/server/db/schema.ts`
- **Change**:
  - Add `issueImages` table matching SQL
  - Relations to `issues`, `issueComments`, `userProfiles`
  - Export `IssueImage` type
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run test:_generate-schema
  ```

### Step 1.4: Blob Configuration

- **Files**: `src/lib/blob/config.ts` (new)
- **Change**:
  - `BLOB_CONFIG` with MIME types, size limits, compression settings, upload limits, rate limits
  - Export `AllowedMimeType` type
- **Verify**:
  ```bash
  pnpm run typecheck
  ```

### Step 1.5: Blob Client

- **Files**: `src/lib/blob/client.ts` (new)
- **Change**:
  - `uploadToBlob(file, pathname)` using `@vercel/blob`
  - `deleteFromBlob(pathname)` with idempotent error handling
- **Verify**:
  ```bash
  pnpm run typecheck
  ```

### Step 1.6: Compression Utilities

- **Files**: `src/lib/images/compression.ts` (new)
- **Change**:
  - `validateImageFile(file)` - check MIME type and size
  - `compressImage(file, mode)` - browser-image-compression wrapper
  - `getImageDimensions(file)` - returns width/height
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm test -- src/lib/images/compression.test.ts
  ```

### Step 1.7: Upload Server Action

- **Files**: `src/server/actions/images.ts` (new)
- **Change**:
  - `uploadIssueImage(formData)`:
    - Auth check (allow anonymous for public reports)
    - Zod validation (issueId, fullImage)
    - Check limits (per-user, per-issue)
    - Upload to Blob
    - Insert DB record
    - Rollback blob on DB failure
    - Revalidate issue page
  - Return `ActionResult<{ imageId: string }>`
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run test:integration -- images
  ```

### Step 1.8: ImageUploadButton Component

- **Files**: `src/components/images/ImageUploadButton.tsx` (new)
- **Change**:
  - Client component with file input
  - Props: onUpload, disabled, currentCount, maxCount
  - Validate file → compress → call onUpload
  - Camera capture for mobile
  - Display "X of Y images"
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run check
  ```

### Step 1.9: ImageGallery Component

- **Files**: `src/components/images/ImageGallery.tsx` (new)
- **Change**:
  - Client component displaying image grid
  - Props: images[], canDelete (false for MVP)
  - Lightbox on click using shadcn Dialog
  - Responsive 2-3 column grid
  - Next.js Image component for optimization
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run check
  ```

### Step 1.10: Integrate into Report Form

- **Files**: `src/app/report/page.tsx`, `src/app/report/actions.ts`
- **Change**:
  - Add image upload section with "Add Photos (Optional)" heading
  - ImageUploadButton for full image upload
  - Preview grid of uploaded images
  - Update form submission to link images to created issue
  - Limit: 2 images for public users
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run dev
  # Manual: Navigate to /report, upload image, submit
  ```

### Step 1.11: Integrate into Issue Detail Page

- **Files**: `src/app/(app)/issues/[id]/page.tsx`
- **Change**:
  - Query `issue_images` for the issue (where deleted_at is null)
  - Add ImageGallery below issue description
  - Show count: "Images (X)"
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run dev
  # Manual: View issue with images, click to zoom
  ```

### Step 1.12: Environment Variables

- **Files**: `.env.local`, `.env.example`
- **Change**:
  - Add `BLOB_READ_WRITE_TOKEN` (auto-set by Vercel)
  - Update `.env.example` with variable name and description
- **Verify**:
  ```bash
  grep BLOB_READ_WRITE_TOKEN .env.example
  ```

### Step 1.13: Basic Tests

- **Files**: `src/lib/images/compression.test.ts`, `src/test/integration/supabase/issue-images.test.ts`
- **Change**:
  - Unit tests for compression utilities
  - Integration tests for DB insert/query
- **Verify**:
  ```bash
  pnpm test
  pnpm run test:integration -- issue-images
  ```

### Step 1.14: Final MVP Verification

- **Files**: All modified files
- **Change**: N/A
- **Verify**:
  ```bash
  pnpm run preflight
  # Manual:
  # - Upload 2 images as public user
  # - Submit report
  # - View issue detail page
  # - Click image to zoom
  ```

---

# PR 2: Image Cropping

**Branch**: `feature/image-cropping`
**Goal**: Add "Highlight Problem Area" crop-first workflow

## Plan

### Step 2.1: Install Cropping Library

- **Files**: `package.json`
- **Change**: `pnpm add react-easy-crop`
- **Verify**:
  ```bash
  grep react-easy-crop package.json
  ```

### Step 2.2: ImageCropper Component

- **Files**: `src/components/images/ImageCropper.tsx` (new)
- **Change**:
  - Client component using `react-easy-crop`
  - Props: imageUrl, onCropComplete, onCancel
  - Mobile-friendly: pinch zoom, drag
  - Canvas extraction for cropped area
  - Full-screen overlay with controls
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run check
  ```

### Step 2.3: Update ImageUploadButton

- **Files**: `src/components/images/ImageUploadButton.tsx`
- **Change**:
  - Add `mode` prop: "full" | "highlight"
  - For "highlight" mode: show cropper after file select
  - Pass both full and cropped blobs to onUpload
  - Messaging: "Help us see the problem, helps us save on storage!"
- **Verify**:
  ```bash
  pnpm run typecheck
  ```

### Step 2.4: Update Compression Utilities

- **Files**: `src/lib/images/compression.ts`
- **Change**:
  - Support "cropped" compression mode (1 MB max, 0.95 quality)
  - Differentiate from "full" mode (2 MB max, 0.9 quality)
- **Verify**:
  ```bash
  pnpm test -- src/lib/images/compression.test.ts
  ```

### Step 2.5: Update Upload Server Action

- **Files**: `src/server/actions/images.ts`
- **Change**:
  - Handle optional `croppedImage` in formData
  - Upload both full and cropped to Blob
  - Store both URLs/pathnames in DB
  - Total file size = full + cropped
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run test:integration -- images
  ```

### Step 2.6: Update Report Form

- **Files**: `src/app/report/page.tsx`
- **Change**:
  - Add second button: "Highlight Problem Area"
  - Two upload modes available to user
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run dev
  # Manual: Test crop workflow on mobile
  ```

### Step 2.7: Update ImageGallery

- **Files**: `src/components/images/ImageGallery.tsx`
- **Change**:
  - Display cropped version if available, full otherwise
  - Add "Detail" badge for cropped images
  - Lightbox shows cropped version
- **Verify**:
  ```bash
  pnpm run check
  ```

### Step 2.8: E2E Test for Cropping

- **Files**: `e2e/image-upload.spec.ts`
- **Change**:
  - Add test for cropping workflow
  - Verify both versions stored
- **Verify**:
  ```bash
  pnpm run smoke -- image-upload
  pnpm run preflight
  ```

---

# PR 3: Image Deletion

**Branch**: `feature/image-deletion`
**Goal**: Users can soft-delete their own images

## Plan

### Step 3.1: Delete Server Action

- **Files**: `src/server/actions/images.ts`
- **Change**:
  - `deleteIssueImage(imageId)`:
    - Auth check (must be logged in)
    - Fetch image from DB
    - Check permissions (owner or admin)
    - Soft delete: set deleted_at and deleted_by
    - Revalidate issue page
  - Return `ActionResult<void>`
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run test:integration -- images
  ```

### Step 3.2: Update ImageGallery

- **Files**: `src/components/images/ImageGallery.tsx`
- **Change**:
  - Add `onDelete` prop
  - Show delete button (trash icon) on hover
  - Only show if `canDelete` is true
  - Confirmation before delete (optional)
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run check
  ```

### Step 3.3: Update Issue Detail Page

- **Files**: `src/app/(app)/issues/[id]/page.tsx`
- **Change**:
  - Calculate `canDelete` (is owner or admin)
  - Pass `onDelete` callback to ImageGallery
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm run dev
  # Manual: Delete own image, verify it disappears
  ```

### Step 3.4: RLS Policy Verification

- **Files**: `src/test/integration/supabase/issue-images.test.ts`
- **Change**:
  - Test: owner can soft delete own image
  - Test: admin can soft delete any image
  - Test: other user cannot delete
- **Verify**:
  ```bash
  pnpm run test:integration -- issue-images
  pnpm run preflight
  ```

---

# PR 4: Automated Cleanup

**Branch**: `feature/image-cleanup`
**Goal**: Permanent deletion after 24 hours + orphan cleanup

## Plan

### Step 4.1: Cleanup Server Actions

- **Files**: `src/server/actions/images.ts`
- **Change**:
  - `permanentlyDeleteExpiredImages()`:
    - Find images with deleted_at > 24 hours ago
    - Delete from Blob storage
    - Hard delete from DB
    - Return count deleted
  - `cleanupOrphanedBlobs()`:
    - List all blobs with prefix 'issue-images/'
    - Query DB for active pathnames
    - Delete orphaned blobs
    - Return count cleaned
- **Verify**:
  ```bash
  pnpm run typecheck
  pnpm test -- src/server/actions/images.test.ts
  ```

### Step 4.2: Cron API Route

- **Files**: `src/app/api/cron/cleanup-images/route.ts` (new)
- **Change**:
  - `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`
  - Verify `CRON_SECRET` from Authorization header
  - Call both cleanup functions
  - Return JSON with counts
  - 401 for invalid secret, 500 for errors
- **Verify**:
  ```bash
  pnpm run typecheck
  curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/cleanup-images
  ```

### Step 4.3: Vercel Cron Config

- **Files**: `vercel.json`
- **Change**:
  - Add cron: path `/api/cron/cleanup-images`, schedule `0 2 * * *` (daily 2 AM)
- **Verify**:
  ```bash
  cat vercel.json
  ```

### Step 4.4: Environment Variable

- **Files**: `.env.local`, `.env.example`
- **Change**:
  - Add `CRON_SECRET` (generate random secret)
- **Verify**:
  ```bash
  grep CRON_SECRET .env.example
  pnpm run preflight
  ```

---

# PR 5: Comment Images (Future)

**Branch**: `feature/comment-images`
**Goal**: Add image upload to comment form

Deferred to later. Same patterns as above, integrating into comment form.

---

## Risks & Mitigations

1. **Cost Overrun** → Strict limits, compression, monitor dashboard weekly
2. **Blob/DB Mismatch** → Rollback blobs on DB failure, orphan cleanup cron
3. **RLS Bypass** → Integration tests for all permission scenarios
4. **Mobile Camera Issues** → Test iOS Safari + Android Chrome, fallback to file picker
5. **Cron Failure** → Monitoring/alerting, manual cleanup script

## Rollback Plan

### Emergency (Feature Off)

- Remove UI components from `/report` and issue pages
- Return early from Server Actions with feature flag
- Keep DB + blobs for re-enable

### Full Removal

- Run cleanup script to delete all blobs
- Drop `issue_images` table
- Remove dependencies
- Delete all related files
