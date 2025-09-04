#!/usr/bin/env node
/**
 * Pre-commit safety check for authentication patterns
 * Prevents commits with dangerous auth patterns
 * Lane B Enhancement - comprehensive auth safety validation
 */

const { execSync } = require('child_process');

// All legacy functions from Lane A inventory
const DANGEROUS_PATTERNS = [
  // Duplicate auth calls - multiple patterns per line
  'requireMemberAccess.*requireMemberAccess',
  'requireOrganizationContext.*requireOrganizationContext', 
  'getOrganizationContext.*requireMemberAccess',
  'getActionAuthContext.*requireMemberAccess',
  'requireMemberAccess.*getOrganizationContext',
  
  // Direct Supabase usage patterns
  'createClient.*@supabase/supabase-js',
  'import.*createClient.*from.*@supabase/supabase-js',
  '@supabase/auth-helpers-nextjs',
  
  // Uncached async exports (basic pattern detection)
  'export async function.*(?!.*cache)',
  'export const.*=.*async.*(?!cache)',
  
  // Legacy auth functions in new code (outside allowed files)
  'getActionAuthContext',
  'getServerAuthContext', 
  'requireActionAuthContextWithPermission',
  'getDALAuthContext',
  'getUserWithOrganization',
  'requireSupabaseUserContext',
  'getUploadAuthContext'
];

// Files allowed to contain dangerous patterns
const ALLOWED_FILES = [
  'src/server/auth/legacy-adapters.ts',
  'src/lib/auth/legacy-inventory.ts',
  'src/lib/organization-context.ts',
  'src/lib/supabase/server.ts',
  'src/lib/supabase/client.ts',
  'eslint-rules/',
  'scripts/',
  'docs/',
  '.test.ts',
  '.spec.ts'
];

function isAllowedFile(filePath) {
  return ALLOWED_FILES.some(allowed => filePath.includes(allowed));
}

function checkAuthSafety() {
  console.log('🔐 Checking authentication safety patterns...');
  
  let totalViolations = 0;
  
  DANGEROUS_PATTERNS.forEach((pattern, index) => {
    try {
      const result = execSync(`rg "${pattern}" src/ --type ts -g "*.tsx"`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      if (result.trim()) {
        const lines = result.trim().split('\n');
        const violations = lines.filter(line => {
          const filePath = line.split(':')[0];
          return !isAllowedFile(filePath);
        });
        
        if (violations.length > 0) {
          console.error(`❌ Dangerous pattern detected: ${pattern}`);
          violations.forEach(violation => {
            console.error(`   ${violation}`);
            totalViolations++;
          });
          console.error('');
        }
      }
    } catch (error) {
      // Pattern not found - good!
      // rg exits with code 1 when no matches found
      if (error.status !== 1) {
        console.warn(`⚠️  Error checking pattern "${pattern}": ${error.message}`);
      }
    }
  });
  
  if (totalViolations > 0) {
    console.error(`💥 Found ${totalViolations} authentication safety violations!`);
    console.error('');
    console.error('💡 To fix these violations:');
    console.error('   1. Use getRequestAuthContext() from ~/server/auth/context');
    console.error('   2. Wrap async server functions with cache()'); 
    console.error('   3. Use ~/lib/supabase/server createClient() wrapper');
    console.error('   4. Avoid duplicate auth resolution calls');
    console.error('');
    console.error('🚫 Commit blocked until violations are resolved');
    process.exit(1);
  }
  
  console.log('✅ Authentication patterns are safe');
}

// Enhanced legacy auth usage check (integration with existing script)
function checkLegacyAuthUsage() {
  console.log('🔍 Checking for legacy authentication function usage...');
  
  try {
    execSync('tsx scripts/check-legacy-auth-usage.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Legacy auth usage check failed');
    process.exit(1);
  }
}

// Cache wrapper validation
function checkCacheUsage() {
  console.log('⚡ Checking for proper cache() usage in server functions...');
  
  try {
    // Find async exports that might need caching
    const result = execSync(`rg "export.*async.*function|export.*const.*=.*async" src/lib/dal/ src/lib/actions/ src/server/ --type ts`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (result.trim()) {
      const lines = result.trim().split('\n');
      const uncachedFunctions = lines.filter(line => !line.includes('cache('));
      
      if (uncachedFunctions.length > 0) {
        console.warn('⚠️  Found potentially uncached async server functions:');
        uncachedFunctions.forEach(func => console.warn(`   ${func}`));
        console.warn('💡 Consider wrapping these functions with cache() for better performance');
        console.warn('');
        // This is a warning, not a blocker
      }
    }
  } catch (error) {
    if (error.status !== 1) {
      console.warn('⚠️  Could not check cache usage patterns');
    }
  }
}

function main() {
  console.log('🛡️  Running comprehensive authentication safety checks...');
  console.log('');
  
  try {
    checkAuthSafety();
    checkLegacyAuthUsage();
    checkCacheUsage();
    
    console.log('');
    console.log('🎉 All authentication safety checks passed!');
  } catch (error) {
    console.error('💥 Authentication safety check failed:', error.message);
    process.exit(1);
  }
}

main();