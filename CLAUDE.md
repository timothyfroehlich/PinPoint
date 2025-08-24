# PinPoint Development Instructions

## 🚨 CRITICAL: Non-Negotiable Patterns 🚨

**ENFORCEMENT REFERENCE:** @docs/NON_NEGOTIABLES.md - Static analysis patterns that MUST be enforced during file reviews

**KEY VIOLATIONS:**

- Memory safety (PGlite per-test instances) → System lockups
- Migration files in pre-beta → Architectural violation
- Vitest redirection → Breaks test execution
- Schema modifications → Breaks locked foundation
- Missing organization scoping → Security vulnerability

---

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

## 🚧 MIGRATION STATUS: TEST SYSTEM REBOOT PHASE 🚧

**CURRENT PHASE**: Test infrastructure archived - Clean foundation for archetype-based reboot

**ARCHIVE STATUS**: ✅ **Test Archive COMPLETE** (~130 files archived to `.archived-tests-2025-08-23/`)
**REMAINING**: pgTAP RLS tests + smoke tests + 1 baseline unit test (205/205 passing)
**FOUNDATION**: Simplified vitest config, clean package.json, isolated archived files
**NEXT**: Archetype-based test system implementation

**APPROACH**: We've completed the "destructive preparation" phase. Now ready for systematic archetype implementation.

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's August 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
- We use husky for precommits and preuploads
- We run shellcheck against our scripts

## 🚨🚨🚨 CRITICAL SYSTEM RESTRICTIONS 🚨🚨🚨

### ⛔ ARCHIVED RESTRICTIONS (No Longer Applicable)

**INTEGRATION TEST PATTERNS** - _Archived with test infrastructure_

- ~~PGlite per-test instances~~
- ~~Complex test utility patterns~~
- ~~Multi-project vitest configs~~

**CURRENT STATE**: Complex testing infrastructure archived to `.archived-tests-2025-08-23/`

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
npm test              # ✅ Simplified unit test suite (205 tests)
npm run test:watch    # ✅ Watch mode for unit tests
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

## ⚡ Available Commands (Post-Archive)

**SIMPLIFIED COMMAND SET** (most commands archived):

```bash
# Basic testing (simplified)
npm test                    # Single unit test suite (205 tests)
npm run test:watch         # Watch mode for unit tests
npm run test:rls           # pgTAP RLS policy tests
npm run smoke             # Playwright smoke tests

# Single-file validation (status unknown - may need updates)
npm run validate-file src/lib/file.ts  # May need verification
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

## 🧪 Testing Architecture (POST-REBOOT)

**CURRENT STATE**: Clean foundation with minimal infrastructure

- **pgTAP RLS Testing**: `npm run test:rls` - Native PostgreSQL RLS validation
- **Unit Testing**: Simplified vitest with 1 baseline test suite (inputValidation.test.ts)
- **Smoke Testing**: Essential Playwright smoke tests only
- **Archived**: ~130 test files, complex PGlite infrastructure, coverage configs, E2E suite

**ARCHETYPE IMPLEMENTATION**: Ready for systematic archetype-based test suite rebuild

## 📐 Testing Archetypes (PLANNED - FOR REBOOT IMPLEMENTATION)

**Future test patterns** (currently archived):

1. Pure Function Unit Test
2. Service Business Logic Test
3. PGlite Integration Test (worker-scoped + seed data)
4. React Component Unit Test
5. tRPC Router Test (mock DB with RLS context)
6. Permission/Auth Test
7. RLS Policy Test (pgTAP)
8. Schema/Database Constraint Test

**CURRENT STATE**: Only archetype patterns 1 and 7 are functional

## 📚 Test System Documentation

**ARCHIVE STATUS**: See `.archived-tests-2025-08-23/ARCHIVE_MANIFEST.md` for complete operation details
**CURRENT DOCS**: Most testing documentation in `docs/testing/` refers to archived infrastructure
**REBOOT PLAN**: See `docs/testing/TEST_SYSTEM_REBOOT_PLAN.md` for archetype implementation plan

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
docs/quick-reference/INDEX.md
docs/quick-reference/testing-patterns.md
@docs/quick-reference/api-security-patterns.md
@docs/quick-reference/typescript-strictest-patterns.md

**Test system status:**
`.archived-tests-2025-08-23/` - Archived test infrastructure (130+ files)
`docs/testing/TEST_SYSTEM_REBOOT_PLAN.md` - Archetype implementation plan
`docs/quick-reference/` - Patterns for current simplified setup

**Priority approach:**
Test infrastructure archived - ready for systematic archetype-based rebuild

- Don't commit or push with --no-verify unless explicitly told to

- I only develop with Claude Code. All documentation should be designed for an efficient LLM who needs to be reminded of context but doesn't need to be convinced to do things.
- I don't care about implementation time estimates or splitting work up into days or sessions. I just want to know the scope of changes, what files need to change and by how much
