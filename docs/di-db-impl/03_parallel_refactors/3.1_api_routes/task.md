# Phase 3.1: API Routes Refactoring

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH 3.2 and 3.3

## Dependencies

- Phase 1 and 2 must be completed first

## Objective

Refactor all Next.js API routes to use database provider pattern instead of direct imports.

## Files to Modify

### 1. `src/app/api/health/route.ts`

**Current:** Direct import of `db`
**Change:** Use `DatabaseProvider` and properly disconnect

```typescript
import { DatabaseProvider } from "~/server/db/provider";

export async function GET() {
  const dbProvider = new DatabaseProvider();
  const db = dbProvider.getClient();

  try {
    await db.$queryRaw`SELECT 1`;
    // ... rest of logic
  } catch (error) {
    // ... error handling
  } finally {
    await dbProvider.disconnect();
  }
}
```

### 2. `src/app/api/dev/users/route.ts`

**Current:** Direct import of `db`
**Change:** Same pattern as health route
**Note:** This is a dev-only route - ensure proper environment checks

### 3. `src/app/api/upload/issue/route.ts`

**Current:** Uses `db` in `uploadAuth.validateUploadAuth`
**Change:**

- Update to pass `db` as parameter to validation function
- Use provider pattern for any direct db usage

### 4. `src/app/api/upload/organization-logo/route.ts`

**Current:** Uses `db` in validation
**Change:** Same as issue upload route

### 5. `src/app/api/qr/[qrCodeId]/route.ts`

**Current:** Check if uses direct db import
**Change:** Use provider pattern if needed

### 6. `src/_archived_frontend/signup/actions.ts`

**Note:** This is archived code
**Decision:** Update for consistency or skip if truly archived

## Common Pattern for All Routes

```typescript
import { DatabaseProvider } from "~/server/db/provider";

export async function HANDLER() {
  const dbProvider = new DatabaseProvider();
  const db = dbProvider.getClient();

  try {
    // ... route logic using db
  } finally {
    await dbProvider.disconnect();
  }
}
```

## Special Considerations

### Upload Authentication

The `uploadAuth.validateUploadAuth` function needs to be updated to accept database as parameter:

```typescript
// src/server/auth/uploadAuth.ts
export async function validateUploadAuth(
  db: ExtendedPrismaClient,
  sessionId?: string,
  organizationId?: string,
) {
  // ... existing logic
}
```

## Testing Requirements

1. Each route still functions correctly
2. No database connection leaks
3. Proper error handling maintained
4. Upload functionality works

## Acceptance Criteria

- [ ] All API routes use DatabaseProvider
- [ ] No direct imports of `db`
- [ ] Proper cleanup with disconnect()
- [ ] uploadAuth accepts db parameter
- [ ] All routes tested manually or with integration tests
