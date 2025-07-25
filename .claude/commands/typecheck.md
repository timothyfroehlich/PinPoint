---
description: TypeScript checking with Betterer regression tracking
allowed-tools: all
argument-hint: "[file-pattern] - Optional file or pattern to check"
---

# TypeScript + Betterer Multi-Config Helper

Checking TypeScript errors for: ${ARGUMENTS:-entire codebase}

## Essential References

@docs/developer-guides/typescript-strictest.md
@CLAUDE.md#typescript-strictest-mode-guidelines
@TYPESCRIPT_MIGRATION.md

## Quick Diagnostics

! npm run typecheck 2>&1 | ${ARGUMENTS:+grep "$ARGUMENTS" |} head -20

## Betterer Status Check

! npm run betterer:check 2>&1 | head -10

## Multi-Config Context

**Production Code (Strictest)**:

- Config: `tsconfig.json`
- Rules: @tsconfig/strictest
- Enforcement: Must pass CI

**Test Utils (Recommended)**:

- Config: `tsconfig.test-utils.json`
- Rules: @tsconfig/recommended
- Enforcement: Warnings only

**Test Files (Relaxed)**:

- Config: `tsconfig.tests.json`
- Rules: Minimal strictness
- Enforcement: Very permissive

## Fix & Lock Progress

```bash
# After fixing TypeScript errors:
npm run betterer:check    # Verify improvement
npm run betterer:update   # Lock in progress
git add .betterer.results # Commit new baseline
```

## Common Patterns

### exactOptionalPropertyTypes

```typescript
// ❌ Bad: undefined not assignable
const data: { prop?: string } = { prop: value || undefined };

// ✅ Good: Conditional assignment
const data: { prop?: string } = {};
if (value) data.prop = value;
```

### strictNullChecks

```typescript
// ✅ Use optional chaining
const id = ctx.session?.user?.id;
if (!id) throw new Error("Not authenticated");
```

### noUncheckedIndexedAccess

```typescript
// ✅ Safe array access
const first = items[0]?.name ?? "Unknown";
const last = items.at(-1)?.name ?? "Unknown";
```

## Validation Commands

```bash
npm run typecheck                    # Production code only
npm run validate                     # Full validation + Betterer
npm run validate               # Agent-friendly validation
npm run betterer:check               # Regression check only
npm run betterer:update              # Lock improvements
```

## Progress Tracking

! npm run betterer:check 2>&1 | grep -E "(better|worse|errors)" || echo "✓ All clean!"

Remember: Fix TypeScript errors first - they often resolve ESLint issues!
