# Things to Revisit

**Purpose**: Track technical decisions and implementation details that need revisiting as the codebase evolves.

**Instructions for Agents**: When you make a tradeoff or temporary decision, add it here with:

- **Task** that created it
- **Decision** made
- **When to revisit** (trigger condition)
- **What to change** (proposed solution)

---

## Active Items

### 🔴 Critical - Revisit Soon

None currently.

---

### 🟡 Important - Revisit When Condition Met

#### Navigation: User Data Source (Task 6.5)

**Decision**: Using `user.user_metadata["name"]` from Supabase auth for user display name

**Why**: Fast (no DB query), already used in dashboard, matches signup flow

**Tradeoff**:

- ✅ No extra database query on every page load
- ❌ Not synced with `user_profiles` table (potential inconsistency)
- ❌ Can't be updated by user (metadata is read-only in app)

**When to Revisit**: When implementing profile editing (Task 9.5 or later)

**What to Change**:

```typescript
// Current (Task 6.5)
userName={user.user_metadata["name"] ?? "User"}

// Future (when profile editing exists)
const profile = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.id, user.id),
});
userName={profile?.name ?? "User"}
```

**Impact**: Will add one DB query per navigation render. Consider React `cache()` wrapper.

---

#### Navigation: Mobile Quick Links Strategy (Task 6.5)

**Decision**: Show Issues/Report (always), hide Machines (mobile only)

**Why**: You requested Issues and Report always visible; Machines seemed less critical

**Tradeoff**:

- ✅ Works well for 2-3 quick links
- ❌ Doesn't scale beyond 4-5 links (navbar gets crowded)

**When to Revisit**: When adding 4th+ quick link (e.g., "Work Queue", "Admin", "Analytics")

**What to Change**:

1. **Option A**: Hamburger menu on mobile (all links collapse)
2. **Option B**: Bottom navigation bar on mobile (iOS/Android pattern)
3. **Option C**: Prioritized visibility (show top 2-3, hide rest)

**Current Open Question**: Should future links also be icon-only on mobile, or do we need a menu?

---

#### Navigation: Logo Behavior for Authenticated Users (Task 6.5)

**Decision**: Logo links to `/dashboard` when authenticated, `/` redirects authenticated users to `/dashboard`

**Why**: Common UX pattern (logo = "home"), prevents seeing sign-up CTAs when logged in

**Tradeoff**:

- ✅ Clear navigation to user's "home"
- ❌ Authenticated users can't access landing page at all
- ❌ Future public content (About, Help, Pricing) would need separate nav links

**When to Revisit**: When adding public informational pages (About, Help, Docs, Pricing)

**What to Change**:

1. Remove redirect from `/` → allow landing page for all users
2. Add separate nav links for public pages
3. OR: Keep current pattern, add "Help" / "About" in footer or user menu

---

#### Database: Push Workflow vs Migrations (Task 2)

**Decision**: Using `drizzle-kit push` for schema changes (destructive, no migration files)

**Why**: Pre-beta with zero users, faster iteration, can blow away data anytime

**Tradeoff**:

- ✅ Fast development (no migration file management)
- ❌ Destructive (data loss on schema changes)
- ❌ No version history of schema evolution

**When to Revisit**: When we have data we can't lose (user signups, real issues)

**Trigger**: First beta user OR moving to production

**What to Change**:

1. Switch to `drizzle-kit generate` + `drizzle-kit migrate`
2. Create initial migration from current schema
3. Update package.json scripts
4. Document in PATTERNS.md
5. Update CI workflow to run migrations

**Reference**: Task 11 (Documentation) will document the migration workflow

---

#### Database: Cross-Schema Foreign Key Constraint (Task 2)

**Decision**: Manual FK constraint in `seed.sql` for `user_profiles.id → auth.users(id)`

**Why**: Drizzle doesn't support cross-schema references (public → auth)

**Tradeoff**:

- ✅ Works correctly (enforced by PostgreSQL)
- ❌ Not visible in Drizzle schema (IDE autocomplete doesn't know)
- ❌ Must remember to maintain seed.sql

**When to Revisit**: If Drizzle adds cross-schema support OR if we move to auth.users table abstraction

**What to Change**: Define FK in Drizzle schema if/when possible, remove from seed.sql

---

### 🟢 Low Priority - Nice to Have

#### ESLint: Add Rules as Patterns Emerge (Task 1)

**Decision**: Started with 20 high-value rules, deferred v1's 617-line config

**Why**: Greenfield should start simple, add complexity based on real needs

**Deferred from v1**:

- Custom rules (no-duplicate-auth-resolution, no-missing-cache-wrapper)
- Security plugins (no-eval, SQL injection detection, XSS patterns)
- Next.js plugin (Server Component patterns)
- Architectural boundary rules (DAL layer separation)

**When to Revisit**: After encountering the same violation 3+ times

**What to Change**: Add rule to `eslint.config.mjs`, document in `docs/ESLINT_RULES.md`

**Reference**: See `.archived_v1/eslint.config.js` for v1's evolved rules

---

#### Testing: Coverage Thresholds May Need Adjustment (Task 5)

**Decision**: 80% coverage enforced from day 1

**Why**: Prevent tech debt, v1 had opt-in coverage which led to gaps

**Tradeoff**:

- ✅ Strict quality bar
- ❌ May be too high for certain files (type definitions, configs)
- ❌ May slow down early prototyping

**When to Revisit**: If 80% becomes blocking (e.g., hitting coverage on Server Components is hard)

**What to Change**:

- Adjust thresholds down (70%?) OR
- Add more exclusions to `vitest.config.ts` OR
- Keep 80% but allow specific files to be excluded

**Current Status**: Working well, no issues yet

---

#### Testing: E2E Test Count (Task 5)

**Decision**: 3 E2E tests now, target 5 for MVP

**Why**: Don't test features that aren't built yet, minimal E2E until critical paths exist

**v1 Comparison**: v1 had 12+ E2E tests for production (subdomains, multi-tenant auth, org switching)

**When to Revisit**: After each major feature (auth, machines, issues, comments)

**What to Add**:

- Task 6: Auth flows (signup, login, logout) ✅ Done
- Task 6.5: Navigation (user menu, quick links) ✅ Done
- Task 7: Machine CRUD
- Task 8: Issue creation and viewing
- Task 9: Comment system

**Target**: 5-10 E2E tests total for MVP (currently at ~8)

---

#### Environment Variables: CI Build Requirements (Task 3)

**Decision**: Created `.env.ci` with dummy credentials (checked into git) for CI builds

**Why**: Next.js 16 evaluates API routes during build, needs DATABASE_URL even for dynamic routes

**Tradeoff**:

- ✅ CI builds pass
- ✅ Clear, maintainable solution
- ⚠️ Dummy credentials in git (clearly marked as non-sensitive)

**When to Revisit**: If we add sensitive routes that can't use dummy data OR if Next.js fixes build-time evaluation

**What to Change**: Potentially move to environment secrets in GitHub Actions if needed

**Current Status**: Working well, no security concerns (dummy data only)

---

## Completed Items (Resolved)

_Items that were revisited and resolved. Keep for historical reference._

None yet.

---

## Template for New Items

Copy this when adding new items:

```markdown
#### Feature: Issue Title (Task X)

**Decision**: What we decided to do

**Why**: Reasoning behind the decision

**Tradeoff**:

- ✅ Benefits
- ❌ Drawbacks

**When to Revisit**: Trigger condition or milestone

**What to Change**: Proposed solution or next steps

**Reference**: Links to relevant docs or code
```

---

## Instructions for Agents

### When to Add Items

Add to REVISIT.md when you:

1. Make a decision with known future limitations
2. Choose a simpler approach that won't scale long-term
3. Implement a workaround for a tool/framework limitation
4. Defer complexity that v1 had (explain why and when to add it back)
5. Make a tradeoff that favors speed over completeness

### When to Move Items

- **To Critical (🔴)**: When the trigger condition is met or issue is causing problems
- **To Completed**: When you implement the change, document what you did

### When to Remove Items

- When the decision is no longer relevant (e.g., rewrote the entire feature)
- When we decide to keep the current approach permanently

---

**Last Updated**: Task 6.5 (Navigation Framework)
