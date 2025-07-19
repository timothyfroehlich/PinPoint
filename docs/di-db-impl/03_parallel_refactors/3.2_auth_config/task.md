# Phase 3.2: Auth Configuration Refactoring

## Priority: MEDIUM - CAN BE DONE IN PARALLEL WITH 3.1 and 3.3

## Dependencies

- Phase 1 and 2 must be completed first

## Objective

Refactor NextAuth configuration to use dependency injection for database access.

## Files to Modify

### 1. `src/server/auth/config.ts`

**Current State:**

- Directly imports `db`
- Uses it for PrismaAdapter
- Exports static `authConfig`

**Target State:**

- Export factory function that accepts database
- Remove direct db import

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { ExtendedPrismaClient } from "~/server/db";
// ... other imports

export const createAuthConfig = (db: ExtendedPrismaClient): NextAuthConfig => ({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      // ... existing credentials config
    }),
  ],
  callbacks: {
    // ... existing callbacks
  },
  // ... rest of config
});
```

### 2. Create `src/server/auth/index.ts` (UPDATE)

**Current State:**

- Exports auth functions from NextAuth

**Target State:**

- Create auth instance with database provider
- Export configured auth functions

```typescript
import NextAuth from "next-auth";
import { getGlobalDatabaseProvider } from "~/server/db/provider";
import { createAuthConfig } from "./config";

const dbProvider = getGlobalDatabaseProvider();
const authConfig = createAuthConfig(dbProvider.getClient());

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
```

### 3. Update `src/server/auth/uploadAuth.ts`

**Current State:**

- Imports `db` directly
- Uses it in validation functions

**Target State:**

- Accept database as parameter
- Remove direct import

```typescript
import type { ExtendedPrismaClient } from "~/server/db";

export async function validateUploadAuth(
  db: ExtendedPrismaClient,
  sessionId?: string,
  organizationId?: string,
): Promise<UploadAuthResult> {
  // ... existing logic using passed db parameter
}
```

## Special Considerations

### Global Auth Instance

- NextAuth needs a single instance for the application
- Using global database provider ensures consistency
- Alternative: Pass database through request context (more complex)

### Session Callbacks

- Ensure callbacks that use database still work correctly
- May need to access db through adapter if needed

## Testing Requirements

1. Authentication still works (Google, Credentials)
2. Session management functions correctly
3. Upload authentication validates properly
4. No database connection issues

## Acceptance Criteria

- [ ] Auth config is a factory function
- [ ] No direct database imports in auth files
- [ ] Authentication flow works correctly
- [ ] Upload auth accepts db parameter
- [ ] Tests pass for auth functionality
