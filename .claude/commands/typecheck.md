---
description: Fix TypeScript strictest mode errors efficiently
allowed-tools: all
argument-hint: "[file-pattern] - Optional file or pattern to check"
---

# TypeScript Strictest Mode Helper

Checking TypeScript errors for: ${ARGUMENTS:-entire codebase}

## Essential References
@docs/developer-guides/typescript-strictest.md
@CLAUDE.md#typescript-strictest-mode-guidelines
@TYPESCRIPT_MIGRATION.md

## Quick Diagnostics

! npm run typecheck 2>&1 | ${ARGUMENTS:+grep "$ARGUMENTS" |} head -30

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
npm run typecheck
npm run typecheck | grep "pattern"     # Filter for specific patterns
npm run debug:typecheck
npm run validate:agent
```

## Progress Tracking
! npm run typecheck 2>&1 | grep -c "error TS" || echo "0 errors! 🎉"

Remember: Fix TypeScript errors first - they often resolve ESLint issues!