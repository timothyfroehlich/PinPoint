# PinPoint Development Instructions

## 🚨 MANDATORY: USE CONTEXT7 EXTENSIVELY 🚨

**CRITICAL DIRECTIVE:** Always use Context7 for current library documentation when:

- Working with any library/framework (Drizzle, Supabase, Next.js, Material UI, Vitest, etc.)
- Your knowledge might be outdated (training cutoff January 2025, now August 2025)
- Looking up API changes, new features, or current best practices
- Need examples of modern patterns and implementation approaches

**Process:** `resolve-library-id` → `get-library-docs` → Apply current patterns
**Why:** Libraries evolve rapidly, my training is 7+ months behind critical updates

---

## Project Context & Development Phase

**CRITICAL CONTEXT**: This is a **solo development project in pre-beta phase**:

- **No users**: Zero production users or real-world usage
- **No production environment**: Still in development/framework building phase
- **Team of 1**: Solo developer, no coordination or migration concerns for others
- **Pre-beta**: Core features and navigation still being decided
- **High risk tolerance**: Breaking things temporarily is completely acceptable
- **E2E tests mostly disabled**: UI/UX still in flux, comprehensive testing not yet needed

**🔥 NO MIGRATION FILES ALLOWED 🔥**

**💥 WHY NO MIGRATIONS IN PRE-BETA:**

- **Zero users**: No production data to migrate or preserve
- **Schema in flux**: Core features and data models still being decided

```bash
# ❌ NEVER CREATE MIGRATION FILES
supabase/migrations/                    # Directory should remain empty
npm run db:generate                     # Don't generate migrations
drizzle-kit generate                    # Don't run migration generation
```

**Impact on Technical Decisions**:

- Optimize for **velocity and learning** over production safety
- **Move fast and break things** is the appropriate approach
- Don't over-engineer solutions for problems that don't exist in this context
- Parallel validation, complex migration infrastructure, and extensive safety measures are **waste** in this phase
- Direct conversion approaches are preferred - cleanup issues as they arise

## 🔒 SCHEMA & SEED DATA LOCK-IN (IMMUTABLE FOUNDATION) 🔒

**CRITICAL CONSTRAINT**: Schema and seed data are **LOCKED IN** and considered immutable:

### **Schema is KING**

- **Database schema is COMPLETE and LOCKED** - no changes allowed
- **All TypeScript errors must be fixed by conforming CODE to SCHEMA**
- Schema defines the source of truth - code adapts to schema, not vice versa
- Only exceptional circumstances justify schema modifications

### **Seed Data is KING**

- **Seed data structure is COMPLETE and LOCKED** - no changes allowed
- All SEED_TEST_IDS are finalized and hardcoded for predictable testing
- Test infrastructure built around existing seed data patterns
- Code and tests must work with existing seed data structure

### **Development Approach**

- ✅ Fix imports to match actual schema exports (`collectionTypes` not `collection_types`)
- ✅ Add required fields that schema demands (`organizationId` in inserts)
- ✅ Use correct property names from schema (`modelId` not `model`)
- ✅ Conform function signatures to existing schema structure
- ❌ **NO** schema changes to fix TypeScript errors
- ❌ **NO** seed data modifications to make code easier

**Why**: Schema and seed represent the completed data architecture. Code quality comes from proper alignment, not schema workarounds.

## 🚧 MIGRATION STATUS: SYSTEMATIC CLEANUP PHASE 🚧

**CURRENT PHASE**: Migration infrastructure complete - now making everything work again

**MIGRATION PROGRESS (Following @migration-plan-v2/):**

- ✅ **Phase 0**: Configuration audit - COMPLETE
- ✅ **Phase 1**: Prisma removal - COMPLETE
- ✅ **Phase 2**: RLS implementation - COMPLETE
- ✅ **Phase 2.5**: Testing architecture (pgTAP + PGlite) - COMPLETE
- 🔄 **Phase 3**: **TypeScript Error Elimination + Test Recovery** - CURRENT PHASE
- ⏳ **Phase 4**: Final cleanup & consolidation

## 🎯 CURRENT PRIORITIES (SYSTEMATIC RECOVERY)

**PHASE 3A: TypeScript Error Elimination** (ACTIVE NOW)

- ✅ Eliminate ALL TypeScript errors with proper fixes (no suppressions)
- ✅ Code conforms to locked schema and seed data
- ✅ Maintain type safety while respecting existing architecture

**PHASE 3B: Test Recovery** (NEXT)

- 🔄 Convert 313 failing tests to new RLS + PGlite architecture
- 🔄 All tests use SEED_TEST_IDS and dual-track testing patterns
- 🔄 Achieve 100% test pass rate with new testing infrastructure

**PHASE 3C: Validation** (FINAL)

- ⏳ Full system validation: builds, lints, tests all green
- ⏳ Performance verification with new architecture
- ⏳ Ready for Phase 4 cleanup

**APPROACH**: We're past the "breaking things" phase. Now it's systematic, methodical fixes respecting the locked foundation.

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's August 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
- We use husky for precommits and preuploads
- We run shellcheck against our scripts

## 🚨🚨🚨 CRITICAL SYSTEM RESTRICTIONS 🚨🚨🚨

### ⛔ ABSOLUTELY FORBIDDEN: Integration Test Memory Patterns

**🔥 NEVER EVER USE THESE PATTERNS 🔥**

```typescript
// ❌ CAUSES SYSTEM LOCKUPS - PGlite memory blowouts
beforeEach(async () => {
  const { db } = await createSeededTestDatabase(); // 50-100MB per test
});

// ❌ CAUSES 1-2GB+ MEMORY USAGE
beforeAll(async () => {
  const client = new PGlite(); // Multiple instances per test file
});

// ❌ ANY PER-TEST DATABASE CREATION
test("...", async () => {
  const testDb = await createTestDatabase(); // Multiplies memory usage
});
```

**💥 WHY THIS BREAKS EVERYTHING:**

- **12+ integration tests** using per-test PGlite = **20+ database instances**
- **50-100MB per instance** = **1-2GB+ total memory usage**
- **Causes system lockups** and computer freezing
- **vitest workers multiply the problem** (4 workers × many instances)

**✅ ONLY ACCEPTABLE PATTERN:**

```typescript
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

test("integration test", async ({ workerDb }) => {
  await withIsolatedTest(workerDb, async (db) => {
    // Test logic - shared PGlite instance, automatic cleanup
  });
});
```

### ⛔ ABSOLUTELY FORBIDDEN: npm test with Redirection

**🔥 NEVER EVER USE THESE COMMANDS 🔥**

```bash
npm test 2>&1          # ❌ BREAKS VITEST
npm test > file.txt    # ❌ BREAKS VITEST
npm test >> file.txt   # ❌ BREAKS VITEST
npm run test:* 2>&1    # ❌ BREAKS VITEST
vitest 2>&1            # ❌ BREAKS VITEST
```

**💥 WHY THIS BREAKS EVERYTHING:**

- Vitest interprets `2>&1`, `>`, `>>` as **test name filters**
- Instead of redirecting output, Vitest searches for tests matching "2>&1"
- This causes bizarre test behavior and broken output
- **NO REDIRECTION WORKS** with Vitest CLI commands

**✅ USE THESE INSTEAD:**

```bash
npm run test:brief     # ✅ Fast, minimal output
npm run test:verbose   # ✅ Detailed output
npm run test:coverage  # ✅ With coverage report
```

### ⛔ Other Command Restrictions

- **NEVER use the `find` command** - it's dangerous due to the `-exec` flag which can execute arbitrary commands
- **NEVER use the `psql` command directly** - use `./scripts/safe-psql.sh` instead for database safety

### ⛔ PostgreSQL Query Limitations

**🚨 CRITICAL: SET Statements Cannot Use Parameters**

```typescript
// ❌ NEVER: Parameterized SET statements (will fail)
await db.execute(sql`SET session.user_id = ${userId}`); // PostgreSQL error

// ✅ ALWAYS: Use sql.raw() with proper escaping for SET statements
await db.execute(sql.raw(`SET session.user_id = '${escapeString(userId)}'`));
```

**Why**: PostgreSQL SET commands are DDL statements, not DML statements - parameters don't work with DDL.

### ✅ Safe Command Alternatives

- **ripgrep (rg)** - for content searching: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **fd/fdfind** - for file discovery: `fd "*.js"`, `fd --type f --changed-within 1day`
- **git ls-files** - for repo files: `git ls-files | grep "\.js$"`
- **safe-psql** - for database access: `./scripts/safe-psql.sh` (localhost-only with safety guardrails)
- Prefer rg (ripgrep) to find or grep
- Install missing tools with `brew` (preferred) or `apt`

## ⚡ Single-File Validation Commands (Fast Development Workflow)

**CRITICAL FOR AGENTS:** Use these commands for fast feedback during development:

```bash
# Fast single-file validation (2-3s vs 30s+ full validation)
npm run validate-file src/server/api/routers/user.ts
npm run check-file src/components/Header.tsx
npm run test-file src/server/api/routers/__tests__/user.test.ts

# Advanced options: --skip-typecheck, --skip-lint, --verbose
node scripts/validate-single-file.cjs FILE --verbose
```

## 🎯 Seed Data Architecture (FOUNDATION PATTERN)

**CRITICAL**: All tests use hardcoded SEED_TEST_IDS for predictable debugging

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Primary patterns
SEED_TEST_IDS.ORGANIZATIONS.primary; // "test-org-pinpoint"
SEED_TEST_IDS.ORGANIZATIONS.competitor; // "test-org-competitor"
SEED_TEST_IDS.USERS.ADMIN; // "test-user-tim"
SEED_TEST_IDS.MOCK_PATTERNS.MACHINE; // "mock-machine-1"
```

**Why**: Predictable debugging vs random UUIDs

## 📐 Testing Archetypes (MANDATORY)

**Every test must follow one archetype pattern**:

1. Pure Function Unit Test
2. Service Business Logic Test
3. PGlite Integration Test (worker-scoped + seed data)
4. React Component Unit Test
5. tRPC Router Test (mock DB with RLS context)
6. Permission/Auth Test
7. RLS Policy Test (pgTAP)
8. Schema/Database Constraint Test

**Quality Gate**: No ad-hoc test patterns allowed

## 🤖 Phase 3 Consultant Workflow (NO AD-HOC FIXES)

**Specialized Agents**:

- `unit-test-architect`: Foundation patterns (Archetypes 1 & 4)
- `integration-test-architect`: Router conversions (Archetypes 2, 3 & 5)
- `security-test-architect`: Security boundaries (Archetypes 6, 7 & 8)

**Rule**: Analysis → Roadmap → Implementation (no shortcuts)

## 🏢 Dual-Organization Testing

**Infrastructure**:

- Primary: "test-org-pinpoint" (Austin Pinball)
- Competitor: "test-org-competitor" (Competitor Arcade)
- Global OPDB catalog visible to both
- Cross-org boundary validation ready

**Usage**: Test organizational isolation with both orgs

## 🧪 Testing Infrastructure

**pgTAP RLS Testing**: `npm run test:rls` - Native PostgreSQL RLS validation
**Business Logic**: Worker-scoped PGlite with BYPASSRLS role
**Complete Testing**: `npm run test:all` - Both tracks together

**Architecture**: pgTAP for security + PGlite for business logic

### Testing Architecture

**⚠️ PGlite Cannot Test Real RLS Policies**

- PGlite lacks Supabase's `auth.jwt()` functions that power RLS policies
- Use **pgTAP** (`supabase/tests/rls/`) for actual RLS validation
- Use **PGlite** (`src/test/helpers/worker-scoped-db.ts`) for business logic only (RLS bypassed)

## 📚 Documentation Synchronization

**WHEN TO UPDATE**: Any seed data or testing pattern changes

**Critical Rule**: All examples must use SEED_TEST_IDS (no random IDs)
**Files**: `docs/testing/`, `docs/quick-reference/`, `docs/developer-guides/`

### 🚨 MANDATORY: Pattern Discovery Synchronization

**CRITICAL WORKFLOW**: When ANY new pattern or "don't" is discovered during development:

1. **ALWAYS UPDATE BOTH** (keep synchronized):
   - `@docs/developer-guides/general-code-review-procedure.md` - Add to appropriate category checklist
   - `@.claude/agents/code-review-architect.md` - Add to XML validation patterns and critical safety scan

2. **Pattern Types Requiring Updates**:
   - **Forbidden patterns** (memory safety, schema violations, etc.)
   - **Enforced patterns** (SEED_TEST_IDS, worker-scoped testing, modern auth)
   - **Quality gates** (new validation commands or expectations)
   - **File categorization** (new file types or patterns)

3. **Synchronization Areas**:
   - Critical safety validations (blocked patterns)
   - Category-specific validation rules
   - XML workflow scan patterns
   - Quality gate commands and expectations

**WHY CRITICAL**: Both documents serve as the foundation for code quality enforcement - they must remain synchronized to ensure comprehensive coverage and consistent guidance.

## 📚 Quick Reference (Auto-Loaded)

Current development patterns (post-migration):
@docs/INDEX.md
@docs/quick-reference/INDEX.md
@docs/quick-reference/testing-patterns.md
@docs/quick-reference/api-security-patterns.md
@docs/quick-reference/typescript-strictest-patterns.md

**Active migration execution:**
@migration-plan-v2/ - Current migration plan being executed (temporary mess expected)
@docs/quick-reference/ - Patterns for implementing current phase work

**Priority approach:**
Execute the migration plan phases systematically - tests will be fixed in Phase 3 as planned

- Don't commit or push with --no-verify unless explicitly told to

- I only develop with Claude Code. All documentation should be designed for an efficient LLM who needs to be reminded of context but doesn't need to be convinced to do things.
- I don't care about implementation time estimates or splitting work up into days or sessions. I just want to know the scope of changes, what files need to change and by how much
