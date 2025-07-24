# Task 002: Remove Unused Upload API Routes

**Priority**: HIGH  
**Category**: Security  
**Status**: Not Started  
**Dependencies**: None

## Problem

Multiple upload API routes exist that:

- Only check authentication, not permissions
- Are only used in archived frontend components
- Duplicate functionality that should be in tRPC

## Current State

Three upload endpoints exist:

- `/api/upload/route.ts` - Generic upload
- `/api/upload/issue/route.ts` - Issue attachments
- `/api/upload/organization-logo/route.ts` - Organization logos

These are only referenced in `_archived_frontend` components.

## Solution

Delete all upload routes since they're unused. When file upload is needed, implement it properly in tRPC with permission checks.

## Implementation Steps

1. Verify routes are truly unused:

   ```bash
   rg -g '!_archived_frontend' -g '!*.test.*' '/api/upload'
   ```

2. Delete the upload routes:

   ```bash
   rm -rf src/app/api/upload
   ```

3. Delete related tests

4. Note: tRPC now supports multipart/form-data for file uploads

## Affected Files

- `src/app/api/upload/route.ts` - DELETE
- `src/app/api/upload/issue/route.ts` - DELETE
- `src/app/api/upload/organization-logo/route.ts` - DELETE
- Related test files - DELETE

## Testing

**Note**: Tests may not pass immediately during the implementation phase. Focus on:

- Ensuring your changes pass linting: `npm run lint`
- Checking TypeScript compilation for your changes: `npm run typecheck:files -- <your-files>`
- Verifying no runtime errors from missing routes

## Success Criteria

- [ ] Upload routes deleted
- [ ] Related tests deleted or updated
- [ ] Your changes pass linting
- [ ] No TypeScript errors in modified files
- [ ] No runtime errors from missing routes

## References

### Core Documentation

- Core objectives: `task_list/README.md`
- Original analysis: `TASK_LIST.md#api-upload--multiple-upload-endpoints`

### Architecture Documentation

- **Source Map**: `docs/architecture/source-map.md` - See "File Upload & Attachment System" section
- **Test Map**: `docs/architecture/test-map.md` - See upload test locations

### Code Locations

- Routes to delete: `src/app/api/upload/`
- tRPC upload procedures: `src/server/api/routers/upload.ts`
- Upload utilities: `src/lib/upload.ts`
- Related tests: `src/server/api/routers/upload.test.ts`

### Migration Notes

- tRPC supports multipart/form-data for file uploads
- See `src/integration-tests/file-upload.test.ts` for proper implementation examples
