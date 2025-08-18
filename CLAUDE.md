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

[... existing content ...]

## Project Context & Development Phase

**CRITICAL CONTEXT**: This is a **solo development project in pre-beta phase**:

- **No users**: Zero production users or real-world usage
- **No production environment**: Still in development/framework building phase
- **Team of 1**: Solo developer, no coordination or migration concerns for others
- **Pre-beta**: Core features and navigation still being decided
- **High risk tolerance**: Breaking things temporarily is completely acceptable
- **E2E tests mostly disabled**: UI/UX still in flux, comprehensive testing not yet needed

**Impact on Technical Decisions**:

- Optimize for **velocity and learning** over production safety
- **Move fast and break things** is the appropriate approach
- Don't over-engineer solutions for problems that don't exist in this context
- Parallel validation, complex migration infrastructure, and extensive safety measures are **waste** in this phase
- Direct conversion approaches are preferred - cleanup issues as they arise

## 🚧 MIGRATION STATUS: ACTIVE EXECUTION - TEMPORARY BREAKAGE EXPECTED 🚧

**CURRENT REALITY**: We're actively executing the migration plan from @migration-plan-v2/ and everything will be messy/broken until completion

**EXPECTED TEMPORARY ISSUES:**
- **🔥 313 failing tests**: Normal during migration - tests will be fixed in Phase 3
- **⚠️ Mixed auth patterns**: Transitional state while implementing RLS
- **🧩 Partial Prisma cleanup**: Being systematically removed following the plan
- **📚 Multiple migration docs**: Part of planned phases, will be consolidated at end

**MIGRATION PROGRESS (Following @migration-plan-v2/):**
- ✅ **Phase 0**: Configuration audit - COMPLETE
- ✅ **Phase 1**: Prisma removal - COMPLETE
- 🔄 **Phase 2**: RLS implementation - ACTIVE/IN PROGRESS
- ⏳ **Phase 3**: Test architecture - will fix the 313 failing tests
- ⏳ **Phase 4**: Cleanup & consolidation

**CRITICAL UNDERSTANDING:**
- The 313 failing tests are **expected** and will remain broken until Phase 3
- We're following the migration plan, not doing ad-hoc fixes
- Everything will be messy until we complete the full architectural transformation

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's July 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
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
npm run test:quiet     # ✅ Suppress console logs
npm run test:verbose   # ✅ Detailed output
npm run test:coverage  # ✅ With coverage report
```

### ⛔ Other Command Restrictions

- **NEVER use the `find` command** - it's dangerous due to the `-exec` flag which can execute arbitrary commands

### ✅ Safe Command Alternatives

- **ripgrep (rg)** - for content searching: `rg --files | rg "pattern"`, `rg -l "content" --type js`
- **fd/fdfind** - for file discovery: `fd "*.js"`, `fd --type f --changed-within 1day`
- **git ls-files** - for repo files: `git ls-files | grep "\.js$"`
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