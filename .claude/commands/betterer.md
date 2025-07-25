---
description: Betterer regression tracking and progress management
allowed-tools: all
argument-hint: "[action] - check, update, or status"
---

# Betterer Multi-Config Helper

Action: ${ARGUMENTS:-status check}

## Current Status

! npm run betterer:check

## Multi-Config Tracking

**What Betterer Tracks:**

1. **typescript strict (production)** - Production code TypeScript errors
2. **typescript recommended (test-utils)** - Test utility TypeScript errors
3. **no explicit any (production)** - Any-type usage in production

## Common Workflows

### Check for Regressions

```bash
npm run betterer:check
```

### Lock in Improvements

```bash
npm run betterer:update
git add .betterer.results
git commit -m "fix: resolve X TypeScript errors"
```

### Watch During Development

```bash
npm run betterer:watch
```

## Integration Commands

```bash
npm run validate              # Includes Betterer check
npm run validate        # Agent validation with Betterer
npm run pre-commit           # Full validation before commit
```

## Understanding Output

**Success**: ✅ X tests got checked. 0 tests got better. 0 tests got worse.
**Improvement**: ✅ X tests got checked. Y tests got better. 0 tests got worse.
**Regression**: ❌ X tests got checked. 0 tests got better. Y tests got worse.

## Current Error Counts

! npm run betterer:check 2>&1 | grep -E "(errors|better|worse)" | head -5
