# Explicit Database Seeding Commands

## Replace Orchestration with Explicit Commands

### Simplified Architecture - Final Design

**Key Decisions:**

- ✅ Single index.ts script with target parameter
- ✅ Minimal validation (almost none for local:pg)
- ✅ No backward compatibility needed - clean break
- ✅ No production commands for safety
- ✅ Reuse existing modules with minor updates

### Final Command Structure

```bash
# Seeding commands (data only, no schema changes)
npm run seed:local:pg    # PostgreSQL-only for CI tests
npm run seed:local:sb    # Local Supabase (default for dev)
npm run seed:preview     # Remote Supabase preview environment

# Reset commands (full wipe + schema + seed)
npm run reset:local      # Full local Supabase reset
npm run reset:preview    # Full preview environment reset

# Backward compatibility (temporary)
npm run seed            # Alias to seed:local:sb
npm run db:reset        # Alias to reset:local (deprecation warning)
```

**NO PRODUCTION COMMANDS** - Intentionally inconvenient for safety

### Implementation Strategy - Simplified

**1. Single Entry Point**

```
scripts/seed/
  index.ts               # Single script with target parameter
  shared/
    infrastructure.ts    # Move from scripts/seed/
    auth-users.ts       # Move from scripts/seed/, remove isProduction()
    sample-data.ts      # Move from scripts/seed/, add minimal/full param
```

**2. index.ts Implementation**

```typescript
#!/usr/bin/env tsx
import { seedInfrastructure } from "./shared/infrastructure";
import { seedAuthUsers } from "./shared/auth-users";
import { seedSampleData } from "./shared/sample-data";

const target = process.argv[2];

if (!["local:pg", "local:sb", "preview"].includes(target)) {
  console.error("Usage: tsx scripts/seed/index.ts <local:pg|local:sb|preview>");
  process.exit(1);
}

// Minimal validation only for preview
if (
  target === "preview" &&
  !process.env.SUPABASE_URL?.includes("supabase.co")
) {
  throw new Error("Preview requires remote Supabase URL");
}

console.log(`🌱 Seeding ${target} environment...`);

// Always seed infrastructure
const org = await seedInfrastructure();

// Conditionally seed auth users (skip for PostgreSQL-only)
if (target !== "local:pg") {
  await seedAuthUsers(org.id);
}

// Seed sample data with amount based on target
const dataAmount = target === "preview" ? "full" : "minimal";
await seedSampleData(org.id, dataAmount);

console.log(`✅ Seeding complete for ${target}`);
```

**3. Minimal Validation**

- **local:pg**: No validation needed, CI controls environment
- **local:sb**: No validation needed, errors will surface naturally
- **preview**: Check for remote Supabase URL (contains 'supabase.co')
- **production**: No script provided - document manual process only

**4. Seeding Strategies by Target**

| Target   | Auth Users | DB Users     | Sample Data | Reset Allowed |
| -------- | ---------- | ------------ | ----------- | ------------- |
| local:pg | ❌ Skip    | ✅ Dev users | ✅ Minimal  | N/A (CI only) |
| local:sb | ✅ Create  | ✅ Dev users | ✅ Minimal  | ✅ Yes        |
| preview  | ✅ Create  | ✅ Dev users | ✅ Full     | ✅ Yes        |

**5. Update Package.json**

```json
{
  "scripts": {
    // Seeding commands
    "seed": "tsx scripts/seed/index.ts local:sb",
    "seed:local:pg": "tsx scripts/seed/index.ts local:pg",
    "seed:local:sb": "tsx scripts/seed/index.ts local:sb",
    "seed:preview": "tsx scripts/seed/index.ts preview",

    // Reset commands
    "reset:local": "supabase db reset && npm run seed:local:sb",
    "reset:preview": "supabase db reset --linked && npm run seed:preview"

    // REMOVE old commands
    // "db:reset", "db:reset:preview", "db:seed:*"
  }
}
```

**6. Update CI Workflows**

- **ci.yml tests**: Use `npm run seed:local:pg`
- **smoke-test.yml**: Use `npm run seed:local:sb` or just `npm run seed`
- Remove all environment detection complexity

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

### Production Seeding (Manual Process)

**Document in `docs/deployment/production-seeding.md`:**

```bash
# Manual production seeding process
# 1. Verify you're connected to production
supabase projects list
supabase link --project-ref <prod-ref>

# 2. Create admin user via Supabase dashboard or CLI
supabase auth admin create-user \
  --email $SEED_ADMIN_EMAIL \
  --password <secure-password>

# 3. No sample data for production
```

### Benefits of Simplified Approach

✅ **Simple**: One script, clear parameters
✅ **Explicit**: Command names clearly indicate target
✅ **Safe**: No production commands available
✅ **Clean**: No environment detection or complex validation
✅ **Maintainable**: All seeding logic in one place
✅ **Reusable**: Existing modules with minor updates

### Implementation Task List

**Documentation Updates (23 files):**

1. ✅ `.claude/agent-plans/explicit-database-seeding-plan.md` - DONE
2. `CLAUDE.md` - Update essential commands section
3. `package.json` - New command structure
4. `.github/workflows/ci.yml` - Change to `seed:local:pg`
5. `.github/workflows/smoke-test.yml` - Change to `seed:local:sb`
6. `docs/testing/test-database.md` - Update seeding references
7. `docs/deployment/environment-management.md` - New commands
8. `docs/deployment/development-deployment-guide.md` - New workflow
9. `docs/deployment/production-deployment-guide.md` - Manual process
10. `docs/developer-guides/troubleshooting.md` - Update commands
11. `docs/security/environment-specific-auth.md` - Remove beta refs
12. `docs/troubleshooting.md` - Update seeding issues
13. `docs/developer-guides/supabase/local-development.md` - New reset
14. `README.md` - Update quick start
15. `scripts/worktree-status.sh` - If it references seeding
16. `docs/quick-reference/migration-patterns.md` - Update examples
17. `docs/architecture/current-state.md` - Update seeding section
18. `docs/orchestrator-system/orchestrator-project.md` - Remove/update
19. `docs/design-docs/*.md` - Update references
20. `docs/README.md` - Update overview
21. `GEMINI.md` - If present, update
22. `.claude/orchestrator-system/orchestrator-project.md` - Remove

**Code Implementation:**

1. Create `scripts/seed/index.ts` with single entry point
2. Move `infrastructure.ts` → `shared/infrastructure.ts`
3. Move `auth-users.ts` → `shared/auth-users.ts` (remove isProduction)
4. Move `sample-data.ts` → `shared/sample-data.ts` (add minimal/full)
5. Delete `scripts/seed/orchestrator.ts`
6. Update `src/lib/environment.ts` - Remove unused functions
7. Update `src/test/seed-data-helpers.ts` if needed

**Testing:**

1. Test `npm run seed:local:pg` (CI simulation)
2. Test `npm run seed:local:sb` (local dev)
3. Test `npm run seed:preview` (with preview env)
4. Test `npm run reset:local`
5. Test `npm run reset:preview`
6. Verify CI workflows still pass

### Current Shared Supabase Project Note

Since preview and production currently use the same Supabase project:

- Be careful with `seed:preview` as it affects production data
- Document manual production process clearly
- When separate projects are created, update validation
