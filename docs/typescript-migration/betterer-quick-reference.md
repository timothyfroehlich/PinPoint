# Betterer Quick Reference

## Daily Usage

### Check for Regressions

```bash
npm run betterer:check
```

Run this before committing to ensure you haven't introduced new errors.

### Update Baseline After Improvements

```bash
npm run betterer:update
```

Run this after fixing errors to update the baseline.

### Watch Mode During Development

```bash
npm run betterer:watch
```

Runs continuously and shows impact of changes in real-time.

## Understanding Betterer Output

### Success (No Changes)

```
✅ 5 tests got checked. 0 tests got better. 0 tests got worse.
```

### Improvement Detected

```
✅ 5 tests got checked. 1 test got better. 0 tests got worse.

typescript strict mode:
  - 121 errors → 115 errors (6 fewer)

Don't forget to run `npm run betterer:update` to save improvements!
```

### Regression Detected

```
❌ 5 tests got checked. 0 tests got better. 1 test got worse.

typescript strict mode:
  - 121 errors → 125 errors (4 more)

Files with new errors:
  - src/components/NewFeature.tsx
```

## What Betterer Tracks

1. **typescript strict mode** - All TypeScript compilation errors
2. **no explicit any (production)** - Usage of 'any' in production code
3. **no unsafe operations (production)** - Unsafe type operations in production
4. **no explicit any (tests)** - Usage of 'any' in test files
5. **no unbound method** - Unbound method references

## Common Scenarios

### Adding a New File

- Betterer will catch any new errors in the file
- Must fix errors or the check will fail

### Fixing Errors in Existing File

1. Fix the errors
2. Run `npm run betterer:check` to verify improvement
3. Run `npm run betterer:update` to save new baseline

### Temporarily Adding Errors

- Not allowed! Betterer will fail the check
- Must fix before committing

### Emergency Override (Use Sparingly)

If you absolutely must merge with regressions:

```bash
# Update the baseline to include new errors
npm run betterer:update
git add .betterer.results
git commit -m "chore: update betterer baseline (temporary regression)"
```

**Note**: This should be rare and requires team discussion.

## Integration with CI

- Betterer runs automatically on every PR
- Blocks merge if regressions are detected
- Shows summary in GitHub Actions
- Updates PR comment with status

## Tips

1. **Fix TypeScript errors first** - They often cause ESLint errors too
2. **Use migration scripts** - `./scripts/migrate-test-file.sh` helps identify issues
3. **Work incrementally** - Fix a few errors at a time
4. **Check before pushing** - Run `npm run betterer:check` locally
5. **Celebrate improvements** - Every error fixed makes the codebase better!
