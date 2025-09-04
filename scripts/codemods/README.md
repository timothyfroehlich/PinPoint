# DAL Migration Codemod

This codemod migrates DAL functions from `ensureOrgContextAndBindRLS` to explicit `organizationId` parameter pattern.

## What it does

**Before:**
```typescript
export const getUserById = cache(async (userId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    // ... database operations with tx
  });
});
```

**After:**
```typescript
export const getUserById = cache(async (userId: string, organizationId: string) => {
  return withOrgRLS(db, organizationId, async (tx) => {
    // ... database operations with tx  
  });
});
```

## Transformations

1. **Function Parameters**: Adds `organizationId: string` parameter if not present
2. **Function Calls**: Replaces `ensureOrgContextAndBindRLS` with `withOrgRLS(db, organizationId, ...)`
3. **Imports**: 
   - Removes `ensureOrgContextAndBindRLS` from `~/lib/organization-context`
   - Adds `withOrgRLS` from `~/server/db/utils/rls`
   - Adds `db` from `./shared`
4. **Variable Cleanup**: Removes `const organizationId = context.organization.id;` declarations
5. **Callback Parameters**: Changes `(tx, context) => ...` to `(tx) => ...`

## Usage

### Test on a single file first:
```bash
npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/users.ts --dry --parser=tsx
```

### Apply to a single file:
```bash
npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/users.ts --parser=tsx
```

### Apply to all DAL files:
```bash
npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/*.ts --parser=tsx
```

### Apply to specific files:
```bash
npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts \
  src/lib/dal/users.ts \
  src/lib/dal/machines.ts \
  src/lib/dal/comments.ts \
  --parser=tsx
```

## Flags

- `--dry`: Preview changes without writing files
- `--print`: Show the transformed output
- `--parser=tsx`: Use TypeScript/TSX parser (required for .ts files)

## Manual Review Required

The codemod will warn about these patterns that need manual attention:

1. **`context.user` references**: These need to be removed or handled differently since the new pattern doesn't have user context
2. **Complex context usage**: Any usage beyond `context.organization.id` will be flagged

Example warnings:
```
Warning: Found context.user usage that needs manual migration in src/lib/dal/users.ts
  Line: 19
  This will need manual review - consider removing auth checks or handling differently
```

## Post-Migration Steps

1. **Review warnings**: Check all files with `context.user` usage
2. **Add parameters**: Functions that need user context should receive it as parameters
3. **Test**: Run tests to ensure migrations work correctly
4. **Type check**: Run `npm run typecheck` to catch any issues

## Target Files

- `src/lib/dal/users.ts`
- `src/lib/dal/machines.ts` 
- `src/lib/dal/comments.ts`
- `src/lib/dal/notifications.ts`
- `src/lib/dal/organizations.ts`
- `src/lib/settings/organization-actions.ts`

## Safety

- Always test with `--dry` first
- The codemod is designed to be safe and preserve functionality
- It only transforms functions that use `ensureOrgContextAndBindRLS`
- It preserves all other code unchanged