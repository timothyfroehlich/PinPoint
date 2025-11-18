# Task 9: Comments System

**Status**: ✅ COMPLETED
**Branch**: `claude/comments-system-01KYPWkGWA2WGyPC9gDoyze6`
**Dependencies**: Task 8.5 (Public Issue Reporting)

## Objective

Add comments to issues (regular user comments, separate from system timeline events).

## Acceptance Criteria

- [x] Can view comments on issue
- [x] Can add new comment
- [x] Comments display with author and timestamp
- [x] Comments separate from timeline events
- [x] Anonymous issues can receive comments from authenticated users
- [x] Works on mobile (responsive design verified)
- [x] All tests pass

## Tasks

### Comments Display

- [x] Update `src/app/issues/[issueId]/page.tsx` (exists at `src/app/(app)/issues/[issueId]/page.tsx`)
- [x] Query comments for issue (with author relation)
  - Comments queried in issue detail page with author relation
  - Timeline component separates system vs user comments via `isSystem` flag
- [x] Display comments list
  - Author name (displays "Unknown User" if NULL)
  - Avatar (not implemented yet - deferred to future iteration)
  - Timestamp (displayed in locale format)
  - Content (displayed with whitespace preserved)
- [x] Order comments by created_at asc (chronological) - **FIXED**

### Add Comment Form

- [x] Update `src/app/issues/[issueId]/actions.ts` (exists at `src/app/(app)/issues/actions.ts`)
- [x] Create Server Action for adding comments
  - Zod validation with trimmed content (CORE-SEC-002) - **IMPROVED**
  - Auth check for author_id (CORE-SEC-001) ✓
  - Set `is_system: false` - **FIXED** to be explicit
  - Database insert with Drizzle ✓
  - Revalidate path ✓
- [x] Add comment form to issue detail page
  - Textarea for comment content ✓
  - Progressive enhancement (uses Server Action directly) ✓
  - Submit button (with loading state via AddCommentSubmitButton) ✓
- [x] Display validation errors (via flash messages) ✓

### Tests

- [x] Unit tests for comment validation - **ADDED** `src/test/unit/comment-validation.test.ts`
- [x] Integration tests for comment queries ✓ (existing)
- [x] Integration tests for comment creation ✓ (existing)
- [x] Integration test: Comments have is_system: false ✓ (existing)
- [x] Integration test: Comments separate from timeline events ✓ (existing)
- [x] E2E test for add comment flow ✓ (existing in `e2e/smoke/issues-crud.spec.ts`)

## Key Decisions

1. **Comment Ordering**: Changed from descending (newest first) to ascending (chronological) order to match task requirements and provide a traditional forum/chat experience.

2. **Explicit `isSystem: false`**: Added explicit `isSystem: false` in the `addCommentAction` instead of relying on schema default for clarity and maintainability.

3. **Whitespace Trimming**: Added `.trim()` to `addCommentSchema` to prevent whitespace-only comments, matching the pattern used in `createIssueSchema`.

4. **No Filtering in Query**: Comments are not filtered by `isSystem` in the database query; instead, the `IssueTimeline` component handles the visual separation of system events vs user comments.

5. **Avatar Deferred**: User avatars are not displayed in this iteration. The `userProfiles` table has an `avatar_url` column, but UI implementation is deferred to a future task.

## Problems Encountered

1. **Initial Implementation on Wrong Branch**: The comment functionality was accidentally implemented on the `claude/research-add-logging-011CV59fVuyzsKFugbWt8Vhd` branch instead of a dedicated comments branch. Required rebasing the `claude/comments-system-01KYPWkGWA2WGyPC9gDoyze6` branch onto the logging branch to continue work.

2. **Comment Ordering**: Original implementation used descending order (newest first), but task required ascending (chronological) order. Fixed in `src/app/(app)/issues/[issueId]/page.tsx:74-76`.

3. **Missing Test Coverage**: No unit tests existed for the `addCommentSchema` validation. Added comprehensive unit tests in `src/test/unit/comment-validation.test.ts`.

4. **Whitespace Validation**: Initial schema allowed whitespace-only comments. Improved schema to trim input, preventing empty comments after trimming.

## Lessons Learned

1. **Explicit vs Implicit Defaults**: While database schemas can provide defaults, explicitly setting values in code (like `isSystem: false`) makes intent clearer and prevents confusion when reading the code.

2. **Pattern Consistency**: Following established patterns (like `.trim()` for user input) across all validation schemas prevents inconsistent behavior and edge cases.

3. **Test-First Discovery**: Writing unit tests for the validation schema uncovered the whitespace bug that would have allowed invalid comments.

4. **Component Architecture**: The separation of concerns between data fetching (page.tsx), display logic (IssueTimeline.tsx), and form handling (AddCommentForm.tsx) makes the feature easy to understand and maintain.

## Updates for CLAUDE.md

**Pattern Addition to `docs/PATTERNS.md`:**

### Comment System Implementation

```typescript
// Server Action for adding comments
export async function addCommentAction(formData: FormData): Promise<void> {
  // 1. Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    await setFlash({ type: "error", message: "Unauthorized" });
    redirect("/login");
  }

  // 2. Validate input (CORE-SEC-002)
  const validation = addCommentSchema.safeParse({
    issueId: formData.get("issueId"),
    comment: formData.get("comment"),
  });

  if (!validation.success) {
    await setFlash({ type: "error", message: "..." });
    redirect(`/issues/${issueId}`);
  }

  // 3. Insert with explicit isSystem: false
  await db.insert(issueComments).values({
    issueId,
    authorId: user.id,
    content: comment,
    isSystem: false, // Explicit, not relying on default
  });

  // 4. Flash message + revalidate + redirect
  await setFlash({ type: "success", message: "Comment added" });
  revalidatePath(`/issues/${issueId}`);
  redirect(`/issues/${issueId}`);
}
```

**Key Points:**

- Always trim user text input in Zod schemas (`.trim()`)
- Explicitly set boolean flags like `isSystem` even when schema has defaults
- Order comments chronologically (`asc`) for timeline/chat-like experiences
- Separate system events from user comments in display logic, not query filters
