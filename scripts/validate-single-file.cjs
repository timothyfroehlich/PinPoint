#!/usr/bin/env node

/**
 * Single File Validation Script for PinPoint
 * 
 * Validates a single file with TypeScript, ESLint, Prettier, and optionally runs related tests
 * Optimized for fast feedback during development
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  extensions: {
    typescript: ['.ts', '.tsx'],
    test: ['.test.ts', '.test.tsx', '.integration.test.ts'],
    source: ['.ts', '.tsx', '.js', '.jsx'],
  },
  testPatterns: {
    // Maps source file patterns to potential test locations
    routerPattern: /src\/server\/api\/routers\/(.+)\.ts$/,
    servicePattern: /src\/server\/services\/(.+)\.ts$/,
    componentPattern: /src\/components\/(.+)\.tsx?$/,
    hookPattern: /src\/hooks\/(.+)\.ts$/,
    libPattern: /src\/lib\/(.+)\.ts$/,
    pagePattern: /src\/app\/(.+)\/page\.tsx?$/,
  }
};

class SingleFileValidator {
  constructor(filePath, options = {}) {
    this.filePath = path.resolve(filePath);
    this.fileName = path.basename(this.filePath);
    this.fileDir = path.dirname(this.filePath);
    this.options = {
      noTests: options.noTests || false,
      testsOnly: options.testsOnly || false,
      verbose: options.verbose || false,
      skipTypecheck: options.skipTypecheck || false,
      skipLint: options.skipLint || false,
      skipFormat: options.skipFormat || false,
      ...options
    };
    
    // Determine if this is a test file or source file
    this.isTestFile = this.isTest(this.filePath);
    this.isSourceFile = !this.isTestFile && this.isSource(this.filePath);
    
    this.results = {
      typecheck: { passed: false, time: 0, output: '' },
      lint: { passed: false, time: 0, output: '' },
      format: { passed: false, time: 0, output: '' },
      tests: { passed: false, time: 0, output: '', filesRun: [] }
    };
  }
  
  isTest(filePath) {
    return CONFIG.extensions.test.some(ext => filePath.endsWith(ext));
  }
  
  isSource(filePath) {
    return CONFIG.extensions.source.some(ext => filePath.endsWith(ext));
  }
  
  isTypeScript(filePath) {
    return CONFIG.extensions.typescript.some(ext => filePath.endsWith(ext));
  }
  
  log(message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : '🔍';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
  
  async runCommand(command, description, skipCondition = false) {
    if (skipCondition) {
      this.log(`Skipping ${description}`, 'info');
      return { passed: true, time: 0, output: 'Skipped' };
    }
    
    const startTime = Date.now();
    this.log(`Running ${description}...`);
    
    try {
      const output = execSync(command, { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      const time = Date.now() - startTime;
      this.log(`${description} passed (${time}ms)`, 'success');
      
      return { passed: true, time, output };
    } catch (error) {
      const time = Date.now() - startTime;
      this.log(`${description} failed (${time}ms)`, 'error');
      
      if (this.options.verbose || !error.stdout) {
        console.error(error.message);
      } else {
        console.error(error.stdout);
      }
      
      return { passed: false, time, output: error.stdout || error.message };
    }
  }
  
  async runTypeCheck() {
    if (!this.isTypeScript(this.filePath)) {
      return { passed: true, time: 0, output: 'Not a TypeScript file' };
    }
    
    // Use tsc --noEmit with the specific file
    const command = `npx tsc --noEmit --pretty false "${this.filePath}"`;
    return await this.runCommand(command, 'TypeScript check', this.options.skipTypecheck);
  }
  
  async runLint() {
    // Use ESLint directly for better single-file performance
    const command = `npx eslint "${this.filePath}" --format compact`;
    return await this.runCommand(command, 'ESLint', this.options.skipLint);
  }
  
  async runFormat() {
    const command = `npx prettier --check "${this.filePath}" --log-level warn`;
    return await this.runCommand(command, 'Prettier format check', this.options.skipFormat);
  }
  
  findRelatedTestFiles() {
    const relatedFiles = new Set();
    
    // If this IS a test file, just return itself
    if (this.isTestFile) {
      relatedFiles.add(this.filePath);
      return Array.from(relatedFiles);
    }
    
    // Otherwise, find tests that might test this source file
    const relativePath = path.relative(process.cwd(), this.filePath);
    
    // Check for co-located test files
    const baseName = path.basename(this.filePath, path.extname(this.filePath));
    const testDir = path.join(this.fileDir, '__tests__');
    
    // Look for test files in same directory or __tests__ subdirectory
    const potentialTestFiles = [
      // Same directory - basic patterns
      path.join(this.fileDir, `${baseName}.test.ts`),
      path.join(this.fileDir, `${baseName}.test.tsx`),
      // Same directory - specific test types
      path.join(this.fileDir, `${baseName}.unit.test.ts`),
      path.join(this.fileDir, `${baseName}.unit.test.tsx`),
      path.join(this.fileDir, `${baseName}.integration.test.ts`),
      path.join(this.fileDir, `${baseName}.integration.test.tsx`),
      // __tests__ subdirectory - basic patterns
      path.join(testDir, `${baseName}.test.ts`),
      path.join(testDir, `${baseName}.test.tsx`),
      // __tests__ subdirectory - specific test types  
      path.join(testDir, `${baseName}.unit.test.ts`),
      path.join(testDir, `${baseName}.unit.test.tsx`),
      path.join(testDir, `${baseName}.integration.test.ts`),
      path.join(testDir, `${baseName}.integration.test.tsx`),
    ];
    
    // Check which test files actually exist
    potentialTestFiles.forEach(testFile => {
      if (fs.existsSync(testFile)) {
        relatedFiles.add(testFile);
      }
    });
    
    // Pattern-based test discovery for specific file types
    for (const [patternName, pattern] of Object.entries(CONFIG.testPatterns)) {
      const match = relativePath.match(pattern);
      if (match) {
        const fileName = match[1];
        
        // Look for integration tests based on patterns
        if (patternName === 'routerPattern') {
          // Check main integration tests directory
          const integrationTestFile = path.join(process.cwd(), 'src/integration-tests', `${fileName}.integration.test.ts`);
          if (fs.existsSync(integrationTestFile)) {
            relatedFiles.add(integrationTestFile);
          }
          
          // Also check for router-specific integration tests in __tests__ subdirectory
          const routerIntegrationTest = path.join(process.cwd(), 'src/server/api/routers/__tests__', `${fileName}.integration.test.ts`);
          if (fs.existsSync(routerIntegrationTest)) {
            relatedFiles.add(routerIntegrationTest);
          }
        }
        
        // Look for service-related integration tests
        if (patternName === 'servicePattern') {
          const serviceIntegrationTest = path.join(process.cwd(), 'src/integration-tests', `${fileName}.integration.test.ts`);
          if (fs.existsSync(serviceIntegrationTest)) {
            relatedFiles.add(serviceIntegrationTest);
          }
        }
      }
    }
    
    // Advanced discovery: Find test files that import this source file
    if (!this.isTestFile && this.isSourceFile) {
      try {
        const importSearchResults = this.findTestFilesByImports();
        importSearchResults.forEach(testFile => relatedFiles.add(testFile));
      } catch (error) {
        // Silent failure - this is an optional enhancement
        if (this.options.verbose) {
          console.log(`Could not perform import-based test discovery: ${error.message}`);
        }
      }
    }
    
    return Array.from(relatedFiles);
  }
  
  findTestFilesByImports() {
    const relatedFiles = [];
    const relativePath = path.relative(process.cwd(), this.filePath);
    
    // Create possible import patterns for this file
    const importPatterns = [
      // TypeScript path alias patterns (~/)
      relativePath.replace(/^src\//, '~/'),
      // Relative import patterns  
      relativePath,
      // Without extension
      relativePath.replace(/\.(ts|tsx)$/, ''),
      relativePath.replace(/^src\//, '~/').replace(/\.(ts|tsx)$/, ''),
      // Just the filename for local imports
      path.basename(this.filePath, path.extname(this.filePath)),
    ];
    
    for (const pattern of importPatterns) {
      try {
        // Use ripgrep to find test files that import this file
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const command = `rg -l "${escapedPattern}"`;  // Simplified - just search for the pattern anywhere
        
        const output = execSync(command, { 
          cwd: process.cwd(),
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // Filter results to only test files
        const foundFiles = output.trim().split('\n').filter(file => 
          file && this.isTest(path.resolve(process.cwd(), file))
        );
        
        foundFiles.forEach(file => {
          const absolutePath = path.resolve(process.cwd(), file);
          relatedFiles.push(absolutePath);
        });
      } catch (error) {
        // Continue to next pattern - rg returns non-zero exit code when no matches found
      }
    }
    
    return [...new Set(relatedFiles)]; // Remove duplicates
  }
  
  async runTests() {
    if (this.options.noTests) {
      return { passed: true, time: 0, output: 'Tests skipped by option', filesRun: [] };
    }
    
    const testFiles = this.findRelatedTestFiles();
    
    if (testFiles.length === 0) {
      this.log('No related test files found');
      return { passed: true, time: 0, output: 'No test files found', filesRun: [] };
    }
    
    this.log(`Found ${testFiles.length} related test file(s): ${testFiles.map(f => path.relative(process.cwd(), f)).join(', ')}`);
    
    const startTime = Date.now();
    
    try {
      // Use Vitest to run the specific test files
      const testFileArgs = testFiles.map(f => `"${f}"`).join(' ');
      const command = `npx vitest run --reporter=dot ${testFileArgs}`;
      
      const output = execSync(command, { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe'
      });
      
      const time = Date.now() - startTime;
      this.log(`Tests passed (${time}ms)`, 'success');
      
      return { 
        passed: true, 
        time, 
        output, 
        filesRun: testFiles.map(f => path.relative(process.cwd(), f))
      };
    } catch (error) {
      const time = Date.now() - startTime;
      this.log(`Tests failed (${time}ms)`, 'error');
      
      if (this.options.verbose || !error.stdout) {
        console.error(error.message);
      } else {
        console.error(error.stdout);
      }
      
      return { 
        passed: false, 
        time, 
        output: error.stdout || error.message,
        filesRun: testFiles.map(f => path.relative(process.cwd(), f))
      };
    }
  }
  
  async validate() {
    const startTime = Date.now();
    
    this.log(`Validating ${path.relative(process.cwd(), this.filePath)}...`);
    this.log(`File type: ${this.isTestFile ? 'Test' : this.isSourceFile ? 'Source' : 'Unknown'}`);
    
    // For test files, we might want different behavior
    if (this.options.testsOnly) {
      this.results.tests = await this.runTests();
    } else {
      // Run validation tools in parallel where possible
      const validationPromises = [];
      
      if (!this.options.testsOnly) {
        validationPromises.push(
          this.runTypeCheck().then(result => this.results.typecheck = result),
          this.runLint().then(result => this.results.lint = result),
          this.runFormat().then(result => this.results.format = result)
        );
      }
      
      // Wait for validation tools to complete
      await Promise.all(validationPromises);
      
      // Run tests after other validations (they might be slower)
      if (!this.options.noTests) {
        this.results.tests = await this.runTests();
      } else {
        this.results.tests = { passed: true, time: 0, output: 'Skipped by --no-tests', filesRun: [] };
      }
    }
    
    const totalTime = Date.now() - startTime;
    this.printSummary(totalTime);
    
    // Return appropriate exit code
    const hasFailures = Object.values(this.results).some(result => !result.passed);
    return hasFailures ? 1 : 0;
  }
  
  printSummary(totalTime) {
    console.log('\n📊 Validation Summary:');
    console.log('═'.repeat(50));
    
    const results = [
      { name: 'TypeScript', result: this.results.typecheck, icon: '🔍' },
      { name: 'ESLint', result: this.results.lint, icon: '🔧' },
      { name: 'Prettier', result: this.results.format, icon: '✨' },
      { name: 'Tests', result: this.results.tests, icon: '🧪' },
    ];
    
    results.forEach(({ name, result, icon }) => {
      if (result.output === 'Skipped') {
        console.log(`${icon} ${name.padEnd(12)} ⏭️  Skipped`);
      } else {
        const status = result.passed ? '✅ Passed' : '❌ Failed';
        const time = result.time > 0 ? ` (${result.time}ms)` : '';
        console.log(`${icon} ${name.padEnd(12)} ${status}${time}`);
        
        if (name === 'Tests' && result.filesRun && result.filesRun.length > 0) {
          console.log(`    📁 Files: ${result.filesRun.join(', ')}`);
        }
      }
    });
    
    console.log('═'.repeat(50));
    console.log(`⏱️  Total time: ${totalTime}ms`);
    
    const passedCount = Object.values(this.results).filter(r => r.passed).length;
    const totalCount = Object.values(this.results).length;
    
    if (passedCount === totalCount) {
      console.log('🎉 All validations passed!');
    } else {
      console.log(`⚠️  ${totalCount - passedCount} validation(s) failed`);
    }
  }
}

// CLI Interface
function showHelp() {
  console.log(`
Single File Validation Tool for PinPoint

Usage:
  node scripts/validate-single-file.cjs <file> [options]

Options:
  --no-tests          Skip running tests
  --tests-only        Only run tests, skip other validations
  --verbose           Show verbose output
  --skip-typecheck    Skip TypeScript checking
  --skip-lint         Skip ESLint
  --skip-format       Skip Prettier format checking
  --help              Show this help message

Examples:
  # Validate a router file (includes related tests)
  node scripts/validate-single-file.cjs src/server/api/routers/user.ts
  
  # Check source code only (no tests)
  node scripts/validate-single-file.cjs src/components/Header.tsx --no-tests
  
  # Run only tests for a test file
  node scripts/validate-single-file.cjs src/server/api/routers/__tests__/user.test.ts --tests-only
  
  # Quick lint and format check
  node scripts/validate-single-file.cjs src/lib/utils.ts --skip-typecheck
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const filePath = args[0];
  
  if (!filePath) {
    console.error('❌ Error: File path is required');
    showHelp();
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const options = {
    noTests: args.includes('--no-tests'),
    testsOnly: args.includes('--tests-only'),
    verbose: args.includes('--verbose'),
    skipTypecheck: args.includes('--skip-typecheck'),
    skipLint: args.includes('--skip-lint'),
    skipFormat: args.includes('--skip-format'),
  };
  
  try {
    const validator = new SingleFileValidator(filePath, options);
    const exitCode = await validator.validate();
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { SingleFileValidator };