#!/usr/bin/env node

/**
 * PinPoint Pattern Reminder Hook
 * 
 * Light educational reminders about critical patterns and forbidden practices.
 * Runs after agent completion to provide gentle guidance without blocking operations.
 * 
 * Exit Code: Always 0 (non-blocking reminders only)
 */

const fs = require('fs');
const path = require('path');

// ANSI colors for better visibility
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m', 
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Critical pattern definitions
const FORBIDDEN_PATTERNS = {
  // Memory Safety Violations (CRITICAL)
  'PGlite Memory Blowout': {
    patterns: [
      /createSeededTestDatabase.*beforeEach/gs,
      /new PGlite\(\)/g,
      /beforeEach.*createSeededTestDatabase/gs
    ],
    severity: 'CRITICAL',
    message: 'PGlite per-test instances cause 1-2GB+ memory usage and system lockups',
    solution: 'Use worker-scoped pattern: import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db"'
  },
  
  // Vitest Command Issues (HIGH)
  'Vitest Redirection': {
    patterns: [
      /pnpm test.*2>&1/g,
      /vitest.*>>/g,
      /pnpm test.*>/g
    ],
    severity: 'HIGH',
    message: 'Vitest interprets redirection as test name filters, breaking execution', 
    solution: 'Use pnpm run test:brief or pnpm run test:verbose instead'
  },
  
  // Database Naming Conventions (HIGH)
  'Snake Case Tables': {
    patterns: [
      /_table\b/g,
      /table_name/g,
      /snake_case_table/g,
      /CREATE TABLE \w+_\w+/gi
    ],
    severity: 'HIGH',
    message: 'Table names must use camelCase, not snake_case (Drizzle requirement)',
    solution: 'Convert to camelCase: user_profiles → userProfiles, machine_issues → machineIssues'
  },
  
  // Deprecated Patterns (MEDIUM)
  'Deprecated Auth Helpers': {
    patterns: [
      /@supabase\/auth-helpers/g,
      /createClientComponentClient/g,
      /createServerComponentClient/g
    ],
    severity: 'MEDIUM',
    message: 'Using deprecated @supabase/auth-helpers package',
    solution: 'Use @supabase/ssr package with createClient() patterns'
  }
};

const ENFORCED_PATTERNS = {
  // Testing Architecture
  'SEED_TEST_IDS Usage': {
    patterns: [
      /SEED_TEST_IDS/g,
      /createMockAdminContext/g,
      /withIsolatedTest/g
    ],
    message: 'Excellent: Using hardcoded test data architecture',
    checkFiles: ['**/*.test.ts', '**/*.integration.test.ts']
  },
  
  // Modern Auth Patterns
  'Supabase SSR Usage': {
    patterns: [
      /@supabase\/ssr/g,
      /createClient\(\)/g
    ],
    message: 'Good: Using modern Supabase SSR patterns',
    checkFiles: ['**/*.ts', '**/*.tsx']
  },
  
  // Memory Safety
  'Worker-Scoped Testing': {
    patterns: [
      /worker-scoped-db/g,
      /withIsolatedTest/g
    ],
    message: 'Excellent: Using memory-safe testing patterns',
    checkFiles: ['**/*.integration.test.ts']
  }
};

function scanForPatterns(content, filePath) {
  const findings = {
    forbidden: [],
    enforced: []
  };
  
  // Check forbidden patterns
  Object.entries(FORBIDDEN_PATTERNS).forEach(([name, config]) => {
    config.patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        findings.forbidden.push({
          name,
          severity: config.severity,
          message: config.message,
          solution: config.solution,
          file: filePath,
          matchCount: matches.length
        });
      }
    });
  });
  
  // Check enforced patterns  
  Object.entries(ENFORCED_PATTERNS).forEach(([name, config]) => {
    const shouldCheck = !config.checkFiles || 
      config.checkFiles.some(pattern => {
        const glob = pattern.replace('**/', '').replace('*', '.*');
        return new RegExp(glob).test(filePath);
      });
      
    if (shouldCheck) {
      config.patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          findings.enforced.push({
            name,
            message: config.message,
            file: filePath,
            matchCount: matches.length
          });
        }
      });
    }
  });
  
  return findings;
}

function scanRecentFiles() {
  const findings = {
    forbidden: [],
    enforced: []
  };
  
  try {
    // Check recently modified files (git status approach)
    const { execSync } = require('child_process');
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: process.cwd() });
    
    const recentFiles = gitStatus
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.slice(3)) // Remove git status prefix
      .filter(file => file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))
      .slice(0, 20); // Limit to recent 20 files for performance
    
    recentFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const fileFindings = scanForPatterns(content, file);
          findings.forbidden.push(...fileFindings.forbidden);
          findings.enforced.push(...fileFindings.enforced);
        }
      } catch (err) {
        // Skip files that can't be read
      }
    });
  } catch (err) {
    // Fallback: skip if git not available or other issues
  }
  
  return findings;
}

function displayReminders(findings) {
  console.log(`\n${colors.blue}${colors.bold}🔍 PinPoint Pattern Reminder${colors.reset}`);
  console.log(`${colors.cyan}Light educational reminders for recent changes${colors.reset}\n`);
  
  // Show forbidden patterns found
  if (findings.forbidden.length > 0) {
    console.log(`${colors.red}${colors.bold}⚠️  Forbidden Patterns Detected${colors.reset}`);
    console.log(`${colors.yellow}Please review these patterns that may cause issues:${colors.reset}\n`);
    
    findings.forbidden.forEach(finding => {
      const severityColor = finding.severity === 'CRITICAL' ? colors.red : 
                           finding.severity === 'HIGH' ? colors.yellow : colors.cyan;
      
      console.log(`${severityColor}${colors.bold}${finding.severity}${colors.reset}: ${finding.name}`);
      console.log(`  File: ${finding.file}`);
      console.log(`  Issue: ${finding.message}`);
      console.log(`  Solution: ${finding.solution}\n`);
    });
  }
  
  // Show positive pattern usage
  if (findings.enforced.length > 0) {
    console.log(`${colors.green}${colors.bold}✅ Good Patterns Detected${colors.reset}`);
    console.log(`${colors.green}Great job following PinPoint's established patterns:${colors.reset}\n`);
    
    // Group by pattern name to avoid duplicates
    const grouped = findings.enforced.reduce((acc, finding) => {
      acc[finding.name] = (acc[finding.name] || 0) + finding.matchCount;
      return acc;
    }, {});
    
    Object.entries(grouped).forEach(([name, count]) => {
      const config = ENFORCED_PATTERNS[name];
      console.log(`  ${colors.green}•${colors.reset} ${config.message} (${count} usages)`);
    });
    console.log('');
  }
  
  // Educational footer
  if (findings.forbidden.length === 0 && findings.enforced.length === 0) {
    console.log(`${colors.green}✨ No pattern issues detected in recent changes${colors.reset}`);
    console.log(`${colors.cyan}Keep up the great work following PinPoint's architectural patterns!${colors.reset}\n`);
  }
  
  console.log(`${colors.cyan}💡 Reference: @docs/developer-guides/general-code-review-procedure.md${colors.reset}`);
  console.log(`${colors.cyan}🤖 Agent: @.claude/agents/code-review-architect.md${colors.reset}\n`);
}

function main() {
  try {
    const findings = scanRecentFiles();
    displayReminders(findings);
    
    // Always exit 0 (non-blocking reminders)
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}Pattern reminder hook error: ${error.message}${colors.reset}`);
    process.exit(0); // Non-blocking even on errors
  }
}

// Skip if we're in node_modules or other ignore paths  
const ignorePaths = ['node_modules', '.git', 'build', 'dist', '.next'];
if (ignorePaths.some(path => process.cwd().includes(path))) {
  process.exit(0);
}

main();