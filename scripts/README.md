# TypeScript Migration Scripts

This directory contains helper scripts for the TypeScript strict mode migration.

## Available Scripts

### migrate-test-file.sh

Analyzes a single test file for strict mode compatibility.

```bash
./scripts/migrate-test-file.sh src/server/api/__tests__/trpc-auth.test.ts
```

Shows:

- All TypeScript strict mode errors
- All ESLint type-safety violations
- Next steps for migration

### migrate-test-directory.sh

Provides overview of all test files in a directory.

```bash
./scripts/migrate-test-directory.sh src/server/api/__tests__/
```

Shows:

- List of all test files
- Error counts for each file
- Total errors in the directory

### update-typescript-stats.sh

Updates the TYPESCRIPT_MIGRATION.md file with current error counts.

```bash
./scripts/update-typescript-stats.sh
```

Automatically:

- Runs typecheck and lint
- Counts errors by type
- Updates migration tracking document
- Preserves error history

### process-csv-issues.ts

Processes CSV exports from GitHub issues for bulk operations.

```bash
npm run process-csv-issues
```

## Migration Workflow

1. Choose a test file or directory to migrate
2. Run the analysis script to see current errors
3. Fix TypeScript errors first (they often resolve ESLint issues)
4. Remove the file from ESLint test overrides
5. Run `npm run validate:agent` to verify
6. Update Betterer baseline: `npm run betterer:update`
7. Commit changes

## Tips

- Start with files that have fewer errors
- Focus on one error type at a time
- Use proper Jest mock typing patterns (see TYPESCRIPT_MIGRATION.md)
- Ask for help if you encounter complex type issues

## TypeScript Error Patterns

### Common Test File Issues

1. **Mock Type Definitions**

   ```typescript
   // ❌ Bad
   const mockFn = jest.fn() as jest.Mock<any>;

   // ✅ Good
   const mockFn = jest.fn<ReturnType, [Parameters]>();
   ```

2. **Prisma Mock with Accelerate**

   ```typescript
   // ✅ Include $accelerate for ExtendedPrismaClient
   const mockPrisma = {
     user: { findUnique: jest.fn() },
     $accelerate: {
       invalidate: jest.fn(),
       invalidateAll: jest.fn(),
     },
   };
   ```

3. **exactOptionalPropertyTypes**

   ```typescript
   // ❌ Bad
   const obj: { prop?: string } = { prop: value || undefined };

   // ✅ Good
   const obj: { prop?: string } = value ? { prop: value } : {};
   ```

## Related Documentation

- [TypeScript Migration Tracker](../TYPESCRIPT_MIGRATION.md)
- [Betterer Integration Plan](../docs/typescript-migration/betterer-integration-plan.md)
- [ESLint Configuration](../eslint.config.js)
