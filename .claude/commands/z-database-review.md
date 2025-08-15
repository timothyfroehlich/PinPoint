---
description: "Database and testing code review tool for Drizzle patterns and quality assurance"
argument-hint: "[impl|tests|full|pr-number|file-path]"
allowed-tools: "Bash(gh pr view:*), Bash(gh pr diff:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(npm run typecheck:brief), Bash(npm run lint:brief), Bash(npm run test:brief), Bash(rg:*), Bash(wc:*), Bash(cat:*), Bash(echo:*), Bash(head:*), Bash(grep:*)"
---

# Database & Testing Code Review

**Purpose:** Review database architecture, Drizzle patterns, and testing quality using August 2025 best practices.

**Context:** Modern full-stack development with Drizzle ORM, Supabase, and comprehensive testing.

**🚨 CRITICAL:** Always check for PGlite memory patterns that can cause system lockups.

## Usage Modes

- `impl` → Review implementation work (database, schemas, queries)
- `tests` → Review testing work (test files, mocks, PGlite) **+ MEMORY ANALYSIS**
- `memory` → **URGENT:** Audit integration tests for memory blowout patterns
- `full` → Comprehensive review (default) **+ MEMORY SAFETY**
- `123` → Review PR #123
- `path/file.ts` → Review specific file

## 🔴 MANDATORY: Memory Pattern Audit

**BEFORE ANY REVIEW - RUN THESE COMMANDS:**

```bash
# 1. Count dangerous PGlite patterns
echo "🔍 Auditing for dangerous memory patterns..."
rg "createSeededTestDatabase|new PGlite" src/integration-tests/ --count || echo "✅ No dangerous patterns found"

# 2. Count worker-scoped usage
echo "🔍 Checking worker-scoped adoption..."
rg "worker-scoped-db|withIsolatedTest" src/integration-tests/ --count || echo "❌ No worker-scoped patterns found"

# 3. Integration test count
echo "🔍 Total integration tests:"
ls src/integration-tests/*.test.ts | wc -l

# 4. Memory risk assessment
echo "🔍 Memory risk calculation:"
echo "Per-test pattern: [dangerous_count] × 50-100MB = [estimated_memory]GB"
echo "Worker-scoped pattern: 1-2 instances × 50-100MB = 200MB max"
```

**BLOCKING CONDITIONS:**
- Any `createSeededTestDatabase` in integration tests = **IMMEDIATE FIX REQUIRED**
- Any `new PGlite()` in test files = **SYSTEM LOCKUP RISK**
- More than 10 integration tests without worker-scoped = **MEMORY BLOWOUT**

!.claude/scripts/database-review/database-review.sh "$ARGUMENTS"