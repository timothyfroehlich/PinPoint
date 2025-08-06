# Explicit Database Seeding Commands

## Replace Orchestration with Explicit Commands

### New Command Structure

```bash
npm run db:seed:local:pg    # Local PostgreSQL container (CI tests)
npm run db:seed:local:sb    # Local Supabase stack (dev, smoke tests)
npm run db:seed:preview     # Remote Supabase preview environment
npm run db:seed:prod        # Remote Supabase production (manual only)
```

### Implementation Strategy

**1. Replace Current Orchestrator**

- Remove `scripts/seed/orchestrator.ts` auto-detection logic
- Create 4 explicit seeding scripts with clear purposes
- Each validates connection to expected backend BEFORE seeding

**2. Script Architecture**

```
scripts/seed/
  local-postgres.ts      # PostgreSQL-only: DB records, no auth users, minimal data
  local-supabase.ts      # Full Supabase: Auth + DB users, minimal sample data
  preview.ts             # Remote Supabase: Auth + DB users, full sample data
  production.ts          # Remote Supabase: Admin only, requires confirmation
  shared/
    infrastructure.ts    # Common org/permissions/roles seeding
    validation.ts        # Connection validation utilities
    types.ts            # Shared interfaces
```

**3. Connection Validation (Before Any Seeding)**

**Local PostgreSQL (`local-postgres.ts`)**:

- Verify `DATABASE_URL` points to localhost PostgreSQL
- Confirm NO Supabase auth environment variables exist
- Test PostgreSQL connection with simple query

**Local Supabase (`local-supabase.ts`)**:

- Verify `SUPABASE_URL` points to localhost:54321
- Confirm Supabase auth environment variables exist
- Test both PostgreSQL and auth API connectivity

**Preview (`preview.ts`)**:

- Verify `SUPABASE_URL` points to remote Supabase project
- Test remote connectivity
- **Note**: Same Supabase project as production currently

**Production (`production.ts`)**:

- Verify `SUPABASE_URL` points to remote Supabase project
- **BLOCK if `CI=true`** (agents can't run this)
- Require `SEED_ADMIN_EMAIL` environment variable
- **Interactive confirmation** (not bypassable with --yes):

  ```
  ⚠️  PRODUCTION SEEDING
  You are about to seed the PRODUCTION database.
  This will create/modify users in the live system.

  Type "CONFIRM PRODUCTION SEEDING" to continue:
  ```

**4. Seeding Strategies by Target**

| Target   | Auth Users | DB Users      | Sample Data | Reset Allowed |
| -------- | ---------- | ------------- | ----------- | ------------- |
| local:pg | ❌ Skip    | ✅ Dev users  | ✅ Minimal  | ✅ Yes        |
| local:sb | ✅ Create  | ✅ Dev users  | ✅ Minimal  | ✅ Yes        |
| preview  | ✅ Create  | ✅ Dev users  | ✅ Full     | ✅ Yes        |
| prod     | ✅ Create  | ✅ Admin only | ❌ None     | ❌ Preserve   |

**5. Update Package.json**

```json
{
  "scripts": {
    "db:seed:local:pg": "tsx scripts/seed/local-postgres.ts",
    "db:seed:local:sb": "tsx scripts/seed/local-supabase.ts",
    "db:seed:preview": "tsx scripts/seed/preview.ts",
    "db:seed:prod": "tsx scripts/seed/production.ts",

    // Maintain backward compatibility temporarily
    "seed": "npm run db:seed:local:sb"
  }
}
```

**6. Update CI Workflows**

- **ci.yml tests**: Use `npm run db:seed:local:pg`
- **smoke-test.yml**: Use `npm run db:seed:local:sb`
- Remove all environment detection complexity

**7. Safety Features**

**Production Script Guards**:

- Exit immediately if `process.env.CI === 'true'`
- Require exact phrase confirmation (prevent automation)
- Log all production seeding actions to audit trail
- Validate admin email format before proceeding

**All Scripts**:

- Connection validation before any operations
- Clear logging of what target is being seeded
- Graceful error handling with specific error messages
- Dry-run mode option for testing

### User Data by Target

**Local PostgreSQL (`local:pg`)**:

```typescript
const users = [
  // Dev Users (3)
  { name: "Dev Admin", email: "admin@dev.local", role: "Admin" },
  { name: "Dev Member", email: "member@dev.local", role: "Member" },
  { name: "Dev Player", email: "player@dev.local", role: "Member" },

  // Pinball Personalities (4)
  { name: "Roger Sharpe", email: "roger.sharpe@pinpoint.dev", role: "Admin" },
  { name: "Gary Stern", email: "gary.stern@pinpoint.dev", role: "Member" },
  {
    name: "Steve Ritchie",
    email: "steve.ritchie@pinpoint.dev",
    role: "Member",
  },
  { name: "Keith Elwin", email: "keith.elwin@pinpoint.dev", role: "Member" },
];
// No auth user creation, only database records + minimal sample data (4 games, 10 issues)
```

**Local Supabase (`local:sb`)**:

```typescript
const users = [
  // Dev Users (3)
  { name: "Dev Admin", email: "admin@dev.local", role: "Admin" },
  { name: "Dev Member", email: "member@dev.local", role: "Member" },
  { name: "Dev Player", email: "player@dev.local", role: "Member" },

  // Pinball Personalities (4)
  { name: "Roger Sharpe", email: "roger.sharpe@pinpoint.dev", role: "Admin" },
  { name: "Gary Stern", email: "gary.stern@pinpoint.dev", role: "Member" },
  {
    name: "Steve Ritchie",
    email: "steve.ritchie@pinpoint.dev",
    role: "Member",
  },
  { name: "Keith Elwin", email: "keith.elwin@pinpoint.dev", role: "Member" },
];
// Create both auth users AND database records + minimal sample data (4 games, 10 issues)
```

**Preview (`preview`)**:

```typescript
const users = [
  // Same as local:sb - identical users and data
  { name: "Dev Admin", email: "admin@dev.local", role: "Admin" },
  { name: "Dev Member", email: "member@dev.local", role: "Member" },
  { name: "Dev Player", email: "player@dev.local", role: "Member" },

  // Pinball Personalities (4)
  { name: "Roger Sharpe", email: "roger.sharpe@pinpoint.dev", role: "Admin" },
  { name: "Gary Stern", email: "gary.stern@pinpoint.dev", role: "Member" },
  {
    name: "Steve Ritchie",
    email: "steve.ritchie@pinpoint.dev",
    role: "Member",
  },
  { name: "Keith Elwin", email: "keith.elwin@pinpoint.dev", role: "Member" },
];
// Create auth users + database records + full sample data (all games, all sample issues)
```

**Production (`prod`)**:

```typescript
const users = [
  {
    name: process.env.SEED_ADMIN_NAME || "Production Admin",
    email: process.env.SEED_ADMIN_EMAIL, // Required
    role: "Admin",
  },
];
// Create single admin user only, no sample data
```

### Benefits

✅ **Explicit**: Command name tells you exactly what gets seeded
✅ **Safe**: Connection validation prevents wrong-target accidents
✅ **Secure**: Production requires manual, non-automatable confirmation
✅ **Clear**: No environment detection magic, just direct commands
✅ **Maintainable**: Each script has single, clear responsibility
✅ **Agent-Safe**: Agents can't accidentally seed production

### Migration Path

1. Create new explicit scripts in `scripts/seed/`
2. Update CI workflows to use new commands
3. Test each command thoroughly
4. Update documentation
5. Remove old orchestrator.ts
6. Update package.json to use new commands by default

### Current Shared Supabase Project Note

Since preview and production currently use the same Supabase project:

- Preview seeding will affect production data
- Production confirmation is critical to prevent accidental overwrites
- When separate projects are created, update connection validation accordingly
- Consider adding project ID validation once projects are separated

This eliminates all auto-detection complexity while making seeding targets completely explicit and safe.
