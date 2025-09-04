#!/usr/bin/env tsx
/**
 * Check for legacy authentication function usage outside allowed files
 * Used in CI to enforce Phase 1 auth consolidation
 */

import { execSync } from 'child_process';
import { exit } from 'process';

const LEGACY_FUNCTIONS = [
  'requireMemberAccess',
  'requireOrganizationContext', 
  'getOrganizationContext',
  'ensureOrgContextAndBindRLS',
];

const ALLOWED_FILES = [
  'src/server/auth/legacy-adapters.ts',
  'src/lib/auth/legacy-inventory.ts',
  'docs/TASKS/phase1-auth-migration.md',
];

interface Violation {
  function: string;
  file: string;
  line: string;
}

function findLegacyUsage(): Violation[] {
  const violations: Violation[] = [];
  
  for (const func of LEGACY_FUNCTIONS) {
    try {
      // Grep for function imports and calls
      const output = execSync(`grep -rn "\\b${func}\\b" src --include="*.ts" --include="*.tsx"`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      const matches = output.trim().split('\n');
      for (const match of matches) {
        if (!match) continue;
        
        const [file, ...lineParts] = match.split(':');
        const line = lineParts.join(':');
        
        // Skip if file is in allowed list
        if (ALLOWED_FILES.some(allowed => file.includes(allowed))) {
          continue;
        }
        
        // Skip comments and type-only imports
        if (line.includes('//') || line.includes('* ') || line.includes('type ')) {
          continue;
        }
        
        violations.push({ function: func, file, line: line.trim() });
      }
    } catch (error) {
      // No matches found for this function (which is good)
      continue;
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Checking for legacy authentication function usage...');
  
  const violations = findLegacyUsage();
  
  if (violations.length === 0) {
    console.log('✅ No legacy authentication functions found outside allowed files');
    exit(0);
  }
  
  console.log('❌ Found legacy authentication function usage:');
  console.log('');
  
  const groupedViolations = violations.reduce((acc, v) => {
    acc[v.file] = acc[v.file] || [];
    acc[v.file].push(v);
    return acc;
  }, {} as Record<string, Violation[]>);
  
  for (const [file, fileViolations] of Object.entries(groupedViolations)) {
    console.log(`📄 ${file}:`);
    for (const violation of fileViolations) {
      console.log(`   ${violation.function}: ${violation.line}`);
    }
    console.log('');
  }
  
  console.log('💡 To fix these violations:');
  console.log('   1. Replace legacy functions with getRequestAuthContext()');
  console.log('   2. Use adapters temporarily if needed');
  console.log('   3. Add files to ALLOWED_FILES if they contain adapters');
  console.log('');
  console.log(`Total violations: ${violations.length}`);
  
  exit(1);
}

main();