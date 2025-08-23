---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Glob, Grep, Read
argument-hint: wd | branch | all | src
description: Check files for non-negotiable pattern violations with automated detection
---

# Check Non-Negotiables

Analyze specified files for violations of PinPoint's critical non-negotiable patterns from @NON_NEGOTIABLES.md.

## File Scope Arguments

- **wd**: Check current uncommitted files in working directory
- **branch**: Check all files in current checked out branch
- **all**: Check entire repository
- **src**: Check all source files in src/ (excluding tests)

## Analysis Process

1. **Determine File Scope**: Based on argument, collect target files
2. **Automated Pattern Detection**: Scan for specific forbidden patterns
3. **Manual Code Review**: Use judgment for complex architectural violations
4. **Priority Assessment**: Categorize findings by severity

## Automated Detection Patterns

### 🚨 CRITICAL (Auto-Block)

- **Memory Safety**: `createSeededTestDatabase()` in `beforeEach()`, `new PGlite()` per test
- **Migration Files**: Any files in `supabase/migrations/`
- **Vitest Redirection**: `npm test 2>&1`, `vitest >>`
- **Parameterized SET**: `sql\`SET._\$\{._\}\``
- **Dangerous Commands**: `find.*-exec`, direct `psql` usage
- **Deprecated Imports**: `@supabase/auth-helpers`
- **TypeScript Safety**: `!\.` (non-null assertion), `: any`, unsafe `as \w+` without validation
- **Import Paths**: `\.\.\/.*\.\.\/.` (deep relative imports like `../../../lib/`)

### ⚡ HIGH (Must Fix Before Merge)

- **Missing Return Types**: Complex async functions without explicit return type annotations
- **Seed Data Modifications**: Changes to SEED_TEST_IDS structure or values

### 🔐 SECURITY (Manual Review)

- **Missing Org Scoping**: tRPC queries without `organizationId` filter
- **Random Test IDs**: `nanoid()`, `crypto.randomUUID()` in tests
- **Schema Modifications**: Changes to schema files during TypeScript fixes
- **API Security**: Missing auth in procedures, generic error messages revealing data
- **Dual-Track RLS Violations**: Mixing pgTAP RLS patterns with PGlite patterns, wrong context for each track

### 🧪 TESTING (Manual Review)

- **Archetype Violations**: Wrong patterns for test purpose (pure functions using DB, integration tests using mocks, tRPC tests using real DB)

### 📋 CONVENTIONS (Manual Review)

- **Drizzle Naming**: snake_case TypeScript variable names in schema files
- **SEED_TEST_IDS**: Missing hardcoded ID usage in tests

## Execution

Based on `$ARGUMENTS`, I will:

1. **Collect target files** using appropriate Git/filesystem commands
2. **Run automated scans** with grep/regex for forbidden patterns
3. **Manually review** files for architectural compliance
4. **Report findings** with specific file locations and fix recommendations

**Target Scope**: $ARGUMENTS
