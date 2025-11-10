#!/usr/bin/env node
/**
 * Integration testing for ESLint enforcement rules
 * Creates temporary files with problematic patterns and verifies ESLint catches them
 * Lane B: Comprehensive rule validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_CASES = [
  {
    name: 'duplicate-auth-resolution',
    code: `
export async function badAction() {
  const ctx1 = await requireMemberAccess();
  const ctx2 = await getOrganizationContext();
  return { ctx1, ctx2 };
}
    `,
    expectedError: 'duplicateAuth/no-duplicate-auth-resolution',
    description: 'Should detect multiple auth calls in same function'
  },
  
  {
    name: 'missing-cache-wrapper', 
    code: `
export async function getUserData(userId) {
  return await db.query.users.findFirst({
    where: eq(users.id, userId)
  });
}
    `,
    expectedError: 'missingCache/no-missing-cache-wrapper',
    description: 'Should detect uncached async server function'
  },
  
  {
    name: 'direct-supabase-import',
    code: `
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  return createClient('url', 'key');
}
    `,
    expectedError: 'directSupabase/no-direct-supabase-client',
    description: 'Should detect direct Supabase client import'
  },
  
  {
    name: 'legacy-auth-import',
    code: `
import { getActionAuthContext, requireSupabaseUserContext } from '~/lib/actions/shared';

export async function badAction() {
  const ctx = await getActionAuthContext();
  return ctx;
}
    `,
    expectedError: 'legacyAuth/no-legacy-auth-imports',
    description: 'Should detect legacy auth function imports'
  },
  
  {
    name: 'explicit-return-type-missing',
    code: `
export async function processData(data) {
  const result = await doSomething(data);
  return result;
}
    `,
    expectedError: '@typescript-eslint/explicit-function-return-type',
    description: 'Should require explicit return types'
  },

  {
    name: 'valid-cached-function',
    code: `
import { cache } from 'react';

export const getUserById = cache(async (id: string): Promise<User | null> => {
  return await db.query.users.findFirst({
    where: eq(users.id, id)
  });
});
    `,
    shouldPass: true,
    description: 'Should allow properly cached function with return type'
  }
];

function createTempFile(testCase) {
  const tempDir = path.join(__dirname, '..', '.temp-eslint-tests');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const tempFile = path.join(tempDir, `test-${testCase.name}.ts`);
  fs.writeFileSync(tempFile, testCase.code);
  return tempFile;
}

function cleanupTempFiles() {
  const tempDir = path.join(__dirname, '..', '.temp-eslint-tests');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
    fs.rmdirSync(tempDir);
  }
}

function testESLintEnforcement() {
  console.log('🧪 Testing ESLint enforcement rules...');
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  // Clean up any existing temp files
  cleanupTempFiles();
  
  TEST_CASES.forEach((testCase, index) => {
    console.log(`${index + 1}. Testing: ${testCase.description}`);
    
    const tempFile = createTempFile(testCase);
    
    try {
      // Run ESLint on the temp file
      const result = execSync(`npx eslint "${tempFile}" --format compact`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // If we get here, ESLint passed (no violations found)
      if (testCase.shouldPass) {
        console.log(`   ✅ PASS - ESLint correctly allowed valid code`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - ESLint should have caught this violation`);
        console.log(`   Expected error: ${testCase.expectedError}`);
        failed++;
      }
      
    } catch (error) {
      // ESLint found violations (exit code 1)
      const output = error.stdout || error.stderr || '';
      
      if (testCase.shouldPass) {
        console.log(`   ❌ FAIL - ESLint incorrectly flagged valid code`);
        console.log(`   Output: ${output.substring(0, 200)}...`);
        failed++;
      } else if (output.includes(testCase.expectedError)) {
        console.log(`   ✅ PASS - ESLint caught expected violation`);
        passed++;
      } else {
        console.log(`   ❌ FAIL - ESLint found violations but not the expected one`);
        console.log(`   Expected: ${testCase.expectedError}`);
        console.log(`   Got: ${output.substring(0, 200)}...`);
        failed++;
      }
    }
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  // Clean up temp directory
  cleanupTempFiles();
  
  console.log('');
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All ESLint enforcement tests passed!');
    return true;
  } else {
    console.log('💥 Some ESLint enforcement tests failed!');
    return false;
  }
}

// Performance testing
function testESLintPerformance() {
  console.log('⚡ Testing ESLint performance impact...');
  
  const startTime = Date.now();
  
  try {
    execSync('npm run lint:eslint', { 
      stdio: 'pipe',
      timeout: 30000 // 30 second timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   Lint time: ${duration}ms`);
    
    if (duration < 10000) { // Under 10 seconds is good
      console.log('   ✅ Performance impact acceptable');
      return true;
    } else {
      console.log('   ⚠️  Performance impact may be high');
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ ESLint failed during performance test');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🛠️  Running ESLint enforcement validation...');
  console.log('');
  
  const testsPass = testESLintEnforcement();
  console.log('');
  const perfGood = testESLintPerformance();
  
  console.log('');
  if (testsPass && perfGood) {
    console.log('🎯 All ESLint enforcement validation passed!');
    process.exit(0);
  } else {
    console.log('❌ ESLint enforcement validation failed!');
    process.exit(1);
  }
}

main();