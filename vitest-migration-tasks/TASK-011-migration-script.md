# TASK-011: Create Jest to Vitest Migration Script

**Priority**: LOW  
**Type**: Automation  
**Estimated Time**: 30-40 minutes  
**Status**: Not Started

## Objective

Create an automated script to help migrate test files from Jest to Vitest, handling common patterns and transformations.

## Prerequisites

- All previous TASK files completed
- Understanding of migration patterns from completed tasks

## Script Requirements

### 1. Core Migration Script

Create `scripts/migrate-to-vitest.ts`:
```typescript
#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { transformSync } from '@babel/core';
import type { NodePath } from '@babel/traverse';

interface MigrationOptions {
  dryRun?: boolean;
  files?: string[];
  interactive?: boolean;
  verbose?: boolean;
}

interface MigrationResult {
  file: string;
  success: boolean;
  changes: string[];
  error?: string;
}

export class VitestMigrator {
  private results: MigrationResult[] = [];

  constructor(private options: MigrationOptions = {}) {}

  async migrate(): Promise<void> {
    const files = await this.getTestFiles();
    
    console.log(`Found ${files.length} test files to migrate`);
    
    for (const file of files) {
      await this.migrateFile(file);
    }
    
    this.printSummary();
  }

  private async getTestFiles(): Promise<string[]> {
    if (this.options.files?.length) {
      return this.options.files;
    }
    
    return glob('src/**/*.test.{ts,tsx}', {
      ignore: ['**/node_modules/**', '**/dist/**'],
    });
  }

  private async migrateFile(filePath: string): Promise<void> {
    const result: MigrationResult = {
      file: filePath,
      success: false,
      changes: [],
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const migrated = this.transformContent(content, filePath);
      
      if (migrated.changes.length > 0) {
        if (!this.options.dryRun) {
          await fs.writeFile(filePath, migrated.code);
        }
        result.success = true;
        result.changes = migrated.changes;
      } else {
        result.success = true;
        result.changes = ['No changes needed'];
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.results.push(result);
    this.printFileResult(result);
  }

  private transformContent(content: string, filePath: string): {
    code: string;
    changes: string[];
  } {
    const changes: string[] = [];
    let code = content;

    // 1. Update imports
    if (code.includes('@jest/globals')) {
      code = code.replace(
        /import\s*{\s*([^}]+)\s*}\s*from\s*['"]@jest\/globals['"]/g,
        (match, imports) => {
          const vitestImports = this.transformJestImports(imports);
          changes.push('Updated @jest/globals imports to vitest');
          return `import { ${vitestImports} } from 'vitest'`;
        }
      );
    }

    // 2. Replace jest.fn() with vi.fn()
    if (code.includes('jest.fn')) {
      code = code.replace(/\bjest\.fn/g, 'vi.fn');
      changes.push('Replaced jest.fn with vi.fn');
    }

    // 3. Replace jest.mock() with vi.mock()
    if (code.includes('jest.mock')) {
      code = code.replace(/\bjest\.mock/g, 'vi.mock');
      changes.push('Replaced jest.mock with vi.mock');
    }

    // 4. Replace jest.spyOn() with vi.spyOn()
    if (code.includes('jest.spyOn')) {
      code = code.replace(/\bjest\.spyOn/g, 'vi.spyOn');
      changes.push('Replaced jest.spyOn with vi.spyOn');
    }

    // 5. Update mock type annotations
    if (code.includes('jest.Mock')) {
      code = code.replace(/\bjest\.Mock/g, 'Mock');
      changes.push('Updated jest.Mock type annotations');
    }

    // 6. Update MockedFunction usage
    if (code.includes('jest.MockedFunction')) {
      code = code.replace(/\bjest\.MockedFunction/g, 'MockedFunction');
      changes.push('Updated jest.MockedFunction type annotations');
    }

    // 7. Handle environment-specific tests
    if (code.includes('@jest-environment')) {
      code = code.replace(
        /\/\*\*\s*@jest-environment\s+(\w+)\s*\*\//g,
        '// @vitest-environment $1'
      );
      changes.push('Updated Jest environment comments to Vitest format');
    }

    // 8. Update test.each syntax if needed
    if (code.includes('test.each')) {
      // Vitest supports the same syntax, but add to changes for awareness
      changes.push('test.each syntax is compatible with Vitest');
    }

    // 9. Add vi import if jest was replaced but vi not imported
    if (code.includes('vi.') && !code.includes("from 'vitest'")) {
      const vitestImportMatch = code.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]vitest['"]/);
      if (vitestImportMatch) {
        const imports = vitestImportMatch[1]!.split(',').map(i => i.trim());
        if (!imports.includes('vi')) {
          code = code.replace(
            vitestImportMatch[0],
            `import { ${[...imports, 'vi'].join(', ')} } from 'vitest'`
          );
          changes.push('Added vi to vitest imports');
        }
      } else {
        // Add new import
        code = `import { vi } from 'vitest';\n${code}`;
        changes.push('Added vitest import with vi');
      }
    }

    // 10. Fix common ESM issues
    if (filePath.endsWith('.ts') && code.includes('export {}')) {
      // Remove unnecessary export {} statements
      code = code.replace(/^\s*export\s*{\s*}\s*;?\s*$/gm, '');
      changes.push('Removed unnecessary export {} statements');
    }

    return { code, changes };
  }

  private transformJestImports(imports: string): string {
    const importList = imports.split(',').map(i => i.trim());
    const transformed = importList.map(imp => {
      switch (imp) {
        case 'jest':
          return 'vi';
        case 'expect':
        case 'describe':
        case 'it':
        case 'test':
        case 'beforeEach':
        case 'afterEach':
        case 'beforeAll':
        case 'afterAll':
          return imp; // These remain the same
        default:
          return imp;
      }
    });
    
    return transformed.join(', ');
  }

  private printFileResult(result: MigrationResult): void {
    if (this.options.verbose || result.error || result.changes.length > 1) {
      console.log(`\n${result.file}:`);
      if (result.error) {
        console.error(`  ❌ Error: ${result.error}`);
      } else if (result.changes.length > 0) {
        result.changes.forEach(change => {
          console.log(`  ✓ ${change}`);
        });
      }
    }
  }

  private printSummary(): void {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const changed = this.results.filter(r => r.success && r.changes.length > 1).length;

    console.log('\n=== Migration Summary ===');
    console.log(`Total files: ${this.results.length}`);
    console.log(`Successfully processed: ${successful}`);
    console.log(`Files with changes: ${changed}`);
    console.log(`Failed: ${failed}`);

    if (this.options.dryRun) {
      console.log('\n⚠️  DRY RUN - No files were actually modified');
    }

    if (failed > 0) {
      console.log('\nFailed files:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.file}: ${r.error}`));
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    files: args.filter(arg => !arg.startsWith('--')),
  };

  const migrator = new VitestMigrator(options);
  migrator.migrate().catch(console.error);
}
```

### 2. Helper Utilities

Create `scripts/vitest-migration-utils.ts`:
```typescript
import fs from 'fs/promises';
import path from 'path';

export async function checkForJestConfig(): Promise<string[]> {
  const issues: string[] = [];
  
  // Check for Jest config files
  const jestConfigs = ['jest.config.js', 'jest.config.ts', 'jest.setup.js'];
  for (const config of jestConfigs) {
    try {
      await fs.access(config);
      issues.push(`Found Jest config file: ${config}`);
    } catch {
      // File doesn't exist, that's fine
    }
  }
  
  // Check package.json for Jest configuration
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
    if (packageJson.jest) {
      issues.push('Found Jest configuration in package.json');
    }
  } catch {
    // Ignore errors
  }
  
  return issues;
}

export async function updatePackageJsonScripts(): Promise<void> {
  const packageJsonPath = 'package.json';
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  
  // Update test scripts
  if (packageJson.scripts) {
    const updates: Record<string, string> = {
      'test': 'vitest',
      'test:watch': 'vitest --watch',
      'test:coverage': 'vitest --coverage',
      'test:ui': 'vitest --ui',
    };
    
    Object.entries(updates).forEach(([key, value]) => {
      if (packageJson.scripts[key]?.includes('jest')) {
        packageJson.scripts[key] = value;
      }
    });
  }
  
  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n'
  );
}

export async function createVitestConfig(): Promise<void> {
  const configContent = `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
});
`;

  await fs.writeFile('vitest.config.ts', configContent);
}
```

### 3. Interactive Migration CLI

Create `scripts/migrate-interactive.ts`:
```typescript
#!/usr/bin/env tsx
import { select, confirm, multiselect } from '@inquirer/prompts';
import { VitestMigrator } from './migrate-to-vitest';
import { 
  checkForJestConfig, 
  updatePackageJsonScripts,
  createVitestConfig 
} from './vitest-migration-utils';
import { glob } from 'glob';

async function main() {
  console.log('🚀 Jest to Vitest Migration Tool\n');

  // Check current state
  const jestIssues = await checkForJestConfig();
  if (jestIssues.length > 0) {
    console.log('⚠️  Found existing Jest configuration:');
    jestIssues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
  }

  // Migration strategy
  const strategy = await select({
    message: 'Select migration strategy:',
    choices: [
      { name: 'Migrate all test files', value: 'all' },
      { name: 'Select specific files', value: 'select' },
      { name: 'Dry run (preview changes)', value: 'dry-run' },
      { name: 'Setup Vitest config only', value: 'config-only' },
    ],
  });

  if (strategy === 'config-only') {
    await setupVitestConfig();
    return;
  }

  let files: string[] = [];
  if (strategy === 'select') {
    const allTests = await glob('src/**/*.test.{ts,tsx}');
    files = await multiselect({
      message: 'Select test files to migrate:',
      choices: allTests.map(file => ({ name: file, value: file })),
    });
  }

  const options = {
    dryRun: strategy === 'dry-run',
    files: files.length > 0 ? files : undefined,
    verbose: true,
  };

  const migrator = new VitestMigrator(options);
  await migrator.migrate();

  if (!options.dryRun) {
    const updateScripts = await confirm({
      message: 'Update package.json scripts?',
      default: true,
    });

    if (updateScripts) {
      await updatePackageJsonScripts();
      console.log('✓ Updated package.json scripts');
    }

    const createConfig = await confirm({
      message: 'Create vitest.config.ts?',
      default: true,
    });

    if (createConfig) {
      await createVitestConfig();
      console.log('✓ Created vitest.config.ts');
    }
  }

  console.log('\n✨ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Run `npm install -D vitest @vitest/ui @vitest/coverage-v8`');
  console.log('2. Remove Jest dependencies: `npm uninstall jest @types/jest ts-jest`');
  console.log('3. Run `npm test` to verify all tests pass');
}

async function setupVitestConfig() {
  await createVitestConfig();
  console.log('✓ Created vitest.config.ts');
  
  await updatePackageJsonScripts();
  console.log('✓ Updated package.json scripts');
  
  console.log('\n✨ Vitest configuration complete!');
  console.log('\nNext steps:');
  console.log('1. Run `npm install -D vitest @vitest/ui @vitest/coverage-v8`');
  console.log('2. Migrate your test files using `npm run migrate:tests`');
}

main().catch(console.error);
```

### 4. Package.json Scripts

Add to package.json:
```json
{
  "scripts": {
    "migrate:tests": "tsx scripts/migrate-to-vitest.ts",
    "migrate:tests:dry": "tsx scripts/migrate-to-vitest.ts --dry-run",
    "migrate:interactive": "tsx scripts/migrate-interactive.ts"
  }
}
```

## Usage Instructions

### Basic Migration
```bash
# Dry run to preview changes
npm run migrate:tests:dry

# Migrate all test files
npm run migrate:tests

# Migrate specific files
npm run migrate:tests src/lib/**/*.test.ts

# Interactive migration
npm run migrate:interactive
```

### Manual Post-Migration Steps

1. **Review Complex Mocks**: The script handles basic replacements, but complex mocks may need manual review
2. **Environment-Specific Tests**: Verify tests with specific environment needs work correctly
3. **Custom Matchers**: If using custom Jest matchers, port them to Vitest
4. **Snapshot Tests**: Run snapshot tests and update as needed

## Verification

- [ ] Script handles all common Jest patterns
- [ ] Dry run mode works correctly
- [ ] Interactive mode provides good UX
- [ ] File transformations are accurate
- [ ] No tests are broken by automatic migration

## Success Criteria

- Script successfully migrates 80%+ of tests automatically
- Clear reporting of what was changed
- Interactive mode helps users make decisions
- Dry run allows safe preview
- Post-migration steps are clearly documented

## Notes

This migration script provides a foundation for automating the Jest to Vitest migration process. While it handles common patterns, some manual intervention may still be required for complex test scenarios.