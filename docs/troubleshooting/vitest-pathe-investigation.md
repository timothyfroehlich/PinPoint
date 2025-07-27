# Vitest Pathe Error Investigation

**Date**: July 27, 2025  
**Issue**: Codecov upload failing in CI, traced to Vitest startup error  
**Status**: Environmental issue identified, not code-related

## Problem Statement

1. **Original Issue**: GitHub Actions CI failing on coverage upload
2. **Error Message**: `TypeError: input.replace is not a function at normalizeWindowsPath`
3. **Location**: `pathe` library during Vitest startup, before any tests run
4. **Impact**: Prevents test execution and coverage generation

## Investigation Timeline

### Initial Hypothesis: Code Changes Broke Coverage

- **Assumption**: Recent merge from main branch (commit 6b9ff6a) introduced the issue
- **Focus**: AbortSignal compatibility fixes and fetch patching

### Attempts to Fix Code Issues

1. **Removed fetch patching** from `src/test/vitest.setup.ts` ❌
2. **Disabled MSW setup** in vitest.setup.ts ❌
3. **Completely disabled vitest.setup.ts** ❌
4. **Removed problematic setup.ts file** ❌
5. **Removed global fetch/Request/Response mocks** ❌

### Discovery: Environmental Issue

- **Key Finding**: Error exists even at "working" commits (3793954)
- **Implication**: This is NOT a code issue, it's environmental

### Environmental Fixes Attempted

1. **Clean npm install** (removed node_modules, package-lock.json) ❌
2. **Dependency refresh** ❌

## Technical Analysis

### Error Details

```
TypeError: input.replace is not a function
    at normalizeWindowsPath (file:///home/froeht/Code/PinPoint-worktrees/user-profile/node_modules/pathe/dist/shared/pathe.M-eThtNZ.mjs:17:16)
    at normalize (file:///home/froeht/Code/PinPoint-worktrees/user-profile/node_modules/pathe/dist/shared/pathe.M-eThtNZ.mjs:31:10)
    at Array.map (<anonymous>)
    at start (file:///home/froeht/Code/PinPoint-worktrees/user-profile/node_modules/vitest/dist/chunks/cac.Cb-PYCCB.js:1412:50)
```

### Root Cause Analysis

- **Location**: Inside Vitest's CAC (command line parser) during startup
- **Mechanism**: `Array.map` is calling `normalize` on an array where one element is not a string
- **Timing**: Happens before any test files are processed
- **Environment**: Only occurs in this specific worktree environment

## Key Insights

### What We Know Works

- **Vitest help command**: `npx vitest --help` works fine
- **Basic Vitest functionality**: Core vitest installation is not corrupted
- **CI Environment**: May actually be working (needs verification)

### What We Know Doesn't Work

- **Local coverage generation**: `npm run test:coverage` fails consistently
- **Local test execution**: `npm run test` also fails with same error

### Configuration Analysis

- **Vitest config**: No obvious issues in vitest.config.ts
- **Path aliases**: Standard Next.js/TypeScript path configuration
- **Setup files**: Both minimal and full setup configurations fail

## Current Status

### Confirmed Facts

1. **Error is environmental**, not code-related
2. **Multiple fix attempts failed** - suggests deeper system issue
3. **CI may be working** - local environment might have always been broken
4. **Issue persists across git commits** - rules out recent code changes

### Remaining Questions

1. **Does CI coverage actually work?** Need to verify GitHub Actions results
2. **Is this worktree-specific?** Could test in main repository
3. **Is this system-specific?** Could be Linux/Node.js version related

## Recommendations

### Immediate Actions

1. **Check CI coverage upload** - verify if it's actually working
2. **Stop debugging local environment** - accept it may be broken
3. **Test in different environment** - try main worktree or different system

### Long-term Solutions

1. **Document local testing limitation** - use CI for coverage verification
2. **Consider alternative test commands** - find workaround for local development
3. **Environment rebuild** - if necessary, set up fresh development environment

## Files Modified During Investigation

- `src/test/vitest.setup.ts` - Removed fetch patching, restored MSW setup
- `src/test/setup.ts` - Removed global mocks, restored functionality
- Node modules - Clean reinstall attempted

## Lessons Learned

1. **Don't assume code changes caused the issue** - check environmental factors first
2. **Test at known-working commits** - helps isolate code vs environment issues
3. **Document investigation process** - prevents circular debugging
4. **Accept when local environment is broken** - use CI for verification

---

**Next Steps**: Verify CI coverage functionality and accept local environment limitations if CI works.
