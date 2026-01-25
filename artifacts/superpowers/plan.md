# Photo Upload Feature Fix Plan

Address 11 Copilot review comments and CI "Verify Migrations" failure.

## Goal

Fix security vulnerabilities, implement missing validation, add tests, and resolve migration verification failure.

## Assumptions

- The feature will not merge until all blockers are resolved
- Tests will follow project patterns (70% unit / 25% integration / 5% E2E)
- Rate limiting will use existing Upstash Redis setup

---

## Plan

### Step 1: Fix Migration Verification Failure

**Files**: `drizzle/0003_add_issue_images_table.sql`, `drizzle/meta/0003_snapshot.json`
**Change**: Regenerate migration to ensure schema matches snapshot. The CI job compares the SQL against the snapshot.
**Verify**:

```bash
pnpm run db:generate --name fix_issue_images
pnpm run typecheck
```

---

### Step 2: Make `uploadedBy` Nullable + Fix FK

**Files**: `src/server/db/schema.ts`, regenerate migration
**Change**:

- Make `uploadedBy` nullable to support anonymous uploads
- Keep explicit `onDelete: "no action"` for audit trail
  **Verify**:

```bash
pnpm run db:generate --name make_uploaded_by_nullable
pnpm run typecheck
```

---

### Step 3: Add Server-Side File Validation

**Files**: `src/server/actions/images.ts`
**Change**: Import and call `validateImageFile` before blob upload. Reject invalid MIME types and sizes server-side.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 4: Implement Blob Cleanup on DB Failure

**Files**: `src/server/actions/images.ts`
**Change**: Add `deleteFromBlob(blob.pathname)` in the catch block when DB insert fails.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 5: Fix Revalidate Paths

**Files**: `src/server/actions/images.ts`
**Change**: Replace `/issues/${issueId}` with `/m` to invalidate all machine/issue pages.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 6: Add Zod Schema for ImageMetadata

**Files**: `src/app/report/actions.ts`
**Change**: Create Zod schema for image metadata array. Validate that blobUrl matches expected Vercel Blob domain pattern.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 7: Fix uploadedBy to Use Null (Not Hardcoded UUID)

**Files**: `src/server/actions/images.ts`, `src/app/report/actions.ts`
**Change**: Replace hardcoded UUID fallback with `null`. Requires Step 2 (nullable column) first.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 8: Fix React Key in Preview

**Files**: `src/app/report/unified-report-form.tsx`
**Change**: Replace `Math.random()` key with `blobPathname` or stable identifier.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 9: Implement Rate Limiting

**Files**: `src/server/actions/images.ts`
**Change**: Add rate limiting using existing Upstash Redis pattern (check `src/app/report/actions.ts` for reference).
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 10: Add Upload Limit Checking

**Files**: `src/server/actions/images.ts`
**Change**: Query DB for existing image count before upload. Enforce `BLOB_CONFIG.LIMITS`.
**Verify**:

```bash
pnpm run typecheck
```

---

### Step 11: Write Unit Tests for Server Action

**Files**: `src/server/actions/images.test.ts` (NEW)
**Change**: Test validation failures, success path, error handling. Mock blob operations.
**Verify**:

```bash
pnpm test src/server/actions/images.test.ts
```

---

### Step 12: Write Integration Tests

**Files**: `src/test/integration/supabase/images.test.ts` (NEW)
**Change**: Test DB operations using PGlite. Cover insert, limit checks, soft delete.
**Verify**:

```bash
pnpm run test:integration
```

---

### Step 13: Final Validation

**Files**: All modified files
**Change**: None
**Verify**:

```bash
pnpm run preflight
```

---

## Risks & Mitigations

| Risk                                   | Mitigation                             |
| -------------------------------------- | -------------------------------------- |
| Breaking change to `uploadedBy` column | Generate additive migration (nullable) |
| Rate limiting adds latency             | Use existing tested Upstash pattern    |
| Mocking blob in tests is complex       | Use dependency injection pattern       |

## Rollback Plan

```bash
git revert HEAD  # Revert fix commit
git push origin feature/multi-photo-upload --force-with-lease
```

---

**Approve this plan? Reply APPROVED if it looks good.**
