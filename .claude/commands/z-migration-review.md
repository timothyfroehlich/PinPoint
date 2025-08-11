---
description: "Comprehensive Drizzle migration review for PR or specific files"
argument-hint: "[pr-number|file-path]"
---

# AI-Powered Drizzle Migration Review

**Objective**: Comprehensive review of direct Prisma-to-Drizzle migration using August 2025 best practices.

**Context**: Solo development, pre-beta, velocity-optimized direct conversion approach.

## Smart Review Mode Detection

$ARGUMENTS can be:

- PR number (e.g., `123`) → Full PR review
- File path (e.g., `src/server/api/routers/issues.ts`) → Deep file analysis
- Empty → Review current branch changes vs main

**Detecting Review Mode:**

```bash
# Detect review mode and get relevant files
if [[ "$ARGUMENTS" =~ ^[0-9]+$ ]]; then
  echo "🔍 PR Review Mode: #$ARGUMENTS"
  !gh pr view $ARGUMENTS
  !gh pr diff $ARGUMENTS --name-only
elif [[ "$ARGUMENTS" == *.ts ]] || [[ "$ARGUMENTS" == *.tsx ]] || [[ "$ARGUMENTS" == *.md ]]; then
  echo "📄 Single File Review Mode: $ARGUMENTS"
  !git log --oneline -5 -- "$ARGUMENTS"
  !git diff HEAD~1..HEAD -- "$ARGUMENTS" || git show HEAD:"$ARGUMENTS" | head -50
else
  CURRENT_BRANCH=$(git branch --show-current)
  if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "📁 Main Branch - Reviewing recent changes"
    !git log --oneline -10
    !git diff HEAD~5..HEAD --name-only
  else
    echo "🔍 Branch Review Mode: $CURRENT_BRANCH vs main"
    !git log main..HEAD --oneline
    !git diff main...HEAD --name-only
    if git diff main...HEAD --quiet; then
      echo "ℹ️ No changes found on branch vs main"
    else
      echo "📋 Files changed on branch:"
      !git diff main...HEAD --stat
    fi
  fi
fi
```

## File Analysis & Categorization

Analyze each file and categorize as:

- **ROUTER**: tRPC router (`src/server/api/routers/*.ts`)
- **TEST**: Test file (`*.test.ts`, `*.integration.test.ts`)
- **SERVER_COMPONENT**: Next.js Server Component (`app/**/*.tsx`)
- **SERVER_ACTION**: Server Actions (`app/actions/*.ts`)
- **SCHEMA**: Database schema (`src/db/schema/*.ts`)
- **GUIDE**: Documentation (`docs/**/*.md`)

## Critical Migration Checklist

### 🗄️ For ROUTER Files - Direct Conversion

**For router files, run these checks:**

```bash
echo "🔧 Deep Router Analysis"
rg -n "ctx\.(db|prisma)" $ARGUMENTS
```

```bash
echo "Checking for Drizzle usage:"
rg -n "ctx\.drizzle|db\.query\." $ARGUMENTS
```

```bash
echo "Checking organization scoping:"
rg -n "eq\(.*organizationId.*ctx\." $ARGUMENTS
```

**Critical Requirements:**

- [ ] **Complete Prisma Elimination**: Zero `ctx.prisma`, `ctx.db` Prisma references
- [ ] **Clean Drizzle Implementation**: Uses `ctx.drizzle` or `db.query` exclusively
- [ ] **Organization Scoping**: Every query includes `eq(table.organizationId, ctx.organizationId)`
- [ ] **Modern Patterns**: Relational queries, enhanced indexes, generated columns

### 🧪 For TEST Files - Modern Vitest

**Testing Strategy Check:**

- [ ] **Type-Safe Mocking**: Uses `vi.mock` with `vi.importActual<typeof ModuleType>()`
- [ ] **PGlite Integration**: In-memory PostgreSQL with `@electric-sql/pglite`
- [ ] **Supabase SSR**: Mocks `@supabase/ssr` (NOT deprecated auth-helpers)
- [ ] **Hoisted Variables**: Uses `vi.hoisted()` for shared mock state

### ⚡ For SERVER_COMPONENT Files

**App Router Patterns:**

- [ ] **Direct Database Access**: Uses Drizzle client directly in async components
- [ ] **Server Auth**: Uses `@supabase/ssr` for authentication
- [ ] **Error Boundaries**: Proper not-found and error handling
- [ ] **Organization Scoping**: All queries properly scoped

### 📝 For GUIDE Files

**Documentation Quality:**

- [ ] **Current Status**: Reflects completed migration (not "in progress")
- [ ] **Modern Examples**: All code samples use Drizzle (no Prisma)
- [ ] **Testing Updates**: References PGlite and Vitest v4.0 patterns
- [ ] **Supabase SSR**: Documents SSR package usage

## Quality Gates Validation

```bash
# Run comprehensive quality checks
echo "🔍 Running Quality Gates..."
npm run typecheck:brief && echo "✅ TypeScript" || echo "❌ TypeScript FAILED"
npm run lint:brief && echo "✅ ESLint" || echo "❌ ESLint FAILED"
npm run test:brief && echo "✅ Tests" || echo "❌ Tests FAILED"
```

## Security & Performance Analysis

### 🔐 Security Validation

```bash
# Critical security checks
rg -n "organizationId" "$ARGUMENTS" || echo "⚠️ Multi-tenancy check needed"
rg -n "TRPCError.*UNAUTHORIZED\|FORBIDDEN" "$ARGUMENTS" || echo "Check auth patterns"
```

**Security Requirements:**

- [ ] **Multi-Tenant Scoping**: All database queries scoped to organization
- [ ] **Permission Validation**: Proper authorization logic maintained
- [ ] **Error Handling**: Secure error messages (no data leakage)
- [ ] **Input Validation**: Zod schemas validate all inputs

### ⚡ Performance Assessment

**Modern Pattern Usage:**

- [ ] **Relational Queries**: Uses `db.query.table.findMany({ with: {...} })`
- [ ] **Generated Columns**: Computed fields moved to database
- [ ] **Prepared Statements**: Frequent queries use `.prepare()`
- [ ] **Type Inference**: Proper `$inferSelect`/`$inferInsert` usage

## Migration Quality Metrics

Analyze and score:

1. **Code Reduction**: Lines eliminated from parallel validation removal
2. **Conversion Completeness**: Percentage of Prisma references eliminated
3. **Pattern Modernization**: Usage of 2025 Drizzle/Supabase/Vitest patterns
4. **Type Safety**: Enhanced compile-time error catching
5. **Performance**: Query optimization and generated column usage

## Detailed Assessment Report

### File-by-File Analysis

For each modified file, provide:

- **Status**: PASS/FAIL for direct conversion alignment
- **Pattern Compliance**: Modern vs legacy pattern usage
- **Security**: Multi-tenancy and permission validation
- **Performance Impact**: Expected improvements

### Critical Issues Identification

- **Immediate Actions**: Security or functionality blockers
- **Performance Concerns**: Query optimization opportunities
- **Pattern Opportunities**: Reusable improvements for other files
- **Testing Gaps**: Missing coverage areas

### Migration Success Indicators

- **Velocity Impact**: Development speed improvements from cleaner code
- **Maintenance Reduction**: Less validation infrastructure burden
- **Learning Enhancement**: Direct Drizzle usage building expertise
- **Type Safety**: Stronger compile-time guarantees

## Final Recommendations

**Overall Assessment**: [EXCELLENT/GOOD/NEEDS_WORK/INCOMPLETE]

**Next Steps**:

1. Address any critical security or functionality issues
2. Optimize performance opportunities identified
3. Apply reusable patterns to other pending conversions
4. Update documentation based on conversion learnings

Focus on direct conversion success: clean Drizzle implementations without parallel validation overhead, optimized for solo development velocity while maintaining security and modern best practices.
