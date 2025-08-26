#!/usr/bin/env node

/**
 * CLI tool for validating test archetype compliance
 * 
 * Usage:
 *   node scripts/validate-test-archetype.cjs <file>
 *   node scripts/validate-test-archetype.cjs 'src/server/...' --all
 * 
 * Examples:
 *   node scripts/validate-test-archetype.cjs src/services/__tests__/userService.test.ts
 *   node scripts/validate-test-archetype.cjs --all --verbose
 *   node scripts/validate-test-archetype.cjs --all --report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const VALIDATION_MODULE = path.join(PROJECT_ROOT, 'src/test/helpers/archetype-validator.ts');

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    let testFiles = [];
    
    if (options.all) {
      testFiles = await findAllTestFiles();
    } else if (options.files.length > 0) {
      testFiles = await resolveTestFiles(options.files);
    } else {
      console.error('❌ No test files specified. Use --help for usage information.');
      process.exit(1);
    }
    
    if (testFiles.length === 0) {
      console.log('ℹ️ No test files found matching the specified pattern.');
      return;
    }
    
    console.log(`🔍 Validating ${testFiles.length} test file(s)...\n`);
    
    // Run validation
    const results = await validateFiles(testFiles, options);
    
    // Process results
    const summary = procesResults(results);
    
    if (options.report) {
      generateDetailedReport(results, summary);
    } else {
      generateSummaryReport(summary);
    }
    
    // Exit with appropriate code
    if (summary.criticalErrors > 0 || summary.highErrors > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    files: [],
    all: false,
    verbose: false,
    report: false,
    help: false,
  };
  
  for (const arg of args) {
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--report' || arg === '-r') {
      options.report = true;
    } else if (!arg.startsWith('-')) {
      options.files.push(arg);
    }
  }
  
  return options;
}

/**
 * Find all test files in the project
 */
async function findAllTestFiles() {
  const patterns = [
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
    'src/**/*.spec.ts', 
    'src/**/*.spec.tsx',
  ];
  
  const files = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: PROJECT_ROOT });
    files.push(...matches.map(f => path.join(PROJECT_ROOT, f)));
  }
  
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Resolve test file patterns to actual file paths
 */
async function resolveTestFiles(patterns) {
  const files = [];
  
  for (const pattern of patterns) {
    if (fs.existsSync(pattern)) {
      files.push(path.resolve(pattern));
    } else {
      // Try glob pattern
      const matches = await glob(pattern, { cwd: PROJECT_ROOT });
      files.push(...matches.map(f => path.join(PROJECT_ROOT, f)));
    }
  }
  
  return [...new Set(files)]; // Remove duplicates
}

/**
 * Validate files using the archetype validator
 */
async function validateFiles(files, options) {
  const results = new Map();
  
  for (const file of files) {
    try {
      if (options.verbose) {
        console.log(`Validating: ${path.relative(PROJECT_ROOT, file)}`);
      }
      
      // Use tsx to run TypeScript validation
      const command = `npx tsx -e "
        const { validateTestArchetype } = require('${VALIDATION_MODULE}');
        const result = validateTestArchetype('${file}');
        console.log(JSON.stringify(result));
      "`;
      
      const output = execSync(command, { encoding: 'utf8', cwd: PROJECT_ROOT });
      const result = JSON.parse(output.trim());
      results.set(file, result);
      
    } catch (error) {
      results.set(file, {
        isValid: false,
        archetype: null,
        agent: null,
        errors: [{
          type: 'validation_error',
          severity: 'critical',
          message: `Validation failed: ${error.message}`,
        }],
        warnings: [],
        suggestions: [],
        compliance: {
          memoryySafety: false,
          rlsContext: false,
          archetypePattern: false,
          importStructure: false,
          errorHandling: false,
        },
      });
    }
  }
  
  return results;
}

/**
 * Process validation results into summary statistics
 */
function procesResults(results) {
  const summary = {
    totalFiles: results.size,
    validFiles: 0,
    criticalErrors: 0,
    highErrors: 0,
    mediumErrors: 0,
    warnings: 0,
    archetypeDistribution: {},
    agentDistribution: {},
    complianceStats: {
      memoryySafety: 0,
      rlsContext: 0,
      archetypePattern: 0,
      importStructure: 0,
      errorHandling: 0,
    },
  };
  
  for (const [file, result] of results) {
    if (result.isValid) summary.validFiles++;
    
    // Count errors by severity
    for (const error of result.errors) {
      if (error.severity === 'critical') summary.criticalErrors++;
      else if (error.severity === 'high') summary.highErrors++;
      else if (error.severity === 'medium') summary.mediumErrors++;
    }
    
    summary.warnings += result.warnings.length;
    
    // Track archetype distribution
    if (result.archetype) {
      summary.archetypeDistribution[result.archetype] = 
        (summary.archetypeDistribution[result.archetype] || 0) + 1;
    }
    
    // Track agent distribution
    if (result.agent) {
      summary.agentDistribution[result.agent] = 
        (summary.agentDistribution[result.agent] || 0) + 1;
    }
    
    // Track compliance stats
    for (const [key, value] of Object.entries(result.compliance)) {
      if (value) summary.complianceStats[key]++;
    }
  }
  
  return summary;
}

/**
 * Generate summary report
 */
function generateSummaryReport(summary) {
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total files: ${summary.totalFiles}`);
  console.log(`Valid files: ${summary.validFiles} (${Math.round((summary.validFiles / summary.totalFiles) * 100)}%)`);
  
  if (summary.criticalErrors > 0) {
    console.log(`🔥 Critical errors: ${summary.criticalErrors}`);
  }
  
  if (summary.highErrors > 0) {
    console.log(`⚠️ High priority errors: ${summary.highErrors}`);
  }
  
  if (summary.mediumErrors > 0) {
    console.log(`⚡ Medium priority errors: ${summary.mediumErrors}`);
  }
  
  if (summary.warnings > 0) {
    console.log(`💡 Warnings: ${summary.warnings}`);
  }
  
  console.log('');
  
  // Agent distribution
  if (Object.keys(summary.agentDistribution).length > 0) {
    console.log('🤖 AGENT DISTRIBUTION:');
    for (const [agent, count] of Object.entries(summary.agentDistribution)) {
      console.log(`   ${agent}: ${count} files`);
    }
    console.log('');
  }
  
  // Status
  if (summary.criticalErrors > 0) {
    console.log('🔥 CRITICAL ISSUES DETECTED');
    console.log('   Fix immediately to prevent system lockups!');
  } else if (summary.highErrors > 0) {
    console.log('⚠️ HIGH PRIORITY ISSUES');
    console.log('   Fix before proceeding with development');
  } else if (summary.validFiles === summary.totalFiles) {
    console.log('✅ ALL FILES PASS VALIDATION');
  } else {
    console.log('⚡ SOME ISSUES FOUND');
    console.log('   Review and fix medium priority issues');
  }
}

/**
 * Generate detailed report with file-by-file breakdown
 */
function generateDetailedReport(results, summary) {
  generateSummaryReport(summary);
  
  console.log('\n📋 DETAILED REPORT');
  console.log('='.repeat(80));
  
  for (const [file, result] of results) {
    const relativePath = path.relative(PROJECT_ROOT, file);
    
    if (!result.isValid || result.warnings.length > 0) {
      console.log(`\n📁 ${relativePath}`);
      console.log(`   Archetype: ${getArchetypeName(result.archetype)}`);
      console.log(`   Agent: ${result.agent || 'Unknown'}`);
      
      if (result.errors.length > 0) {
        console.log('   ❌ ERRORS:');
        for (const error of result.errors) {
          const icon = getSeverityIcon(error.severity);
          console.log(`      ${icon} ${error.message}`);
          if (error.suggestion) {
            console.log(`         💡 ${error.suggestion}`);
          }
        }
      }
      
      if (result.warnings.length > 0) {
        console.log('   ⚠️ WARNINGS:');
        for (const warning of result.warnings) {
          console.log(`      • ${warning.message}`);
          if (warning.suggestion) {
            console.log(`        💡 ${warning.suggestion}`);
          }
        }
      }
      
      if (result.suggestions.length > 0) {
        console.log('   💡 SUGGESTIONS:');
        for (const suggestion of result.suggestions) {
          console.log(`      • ${suggestion}`);
        }
      }
    }
  }
}

/**
 * Helper functions
 */
function getArchetypeName(archetype) {
  const names = {
    1: 'Pure Function Unit Test',
    2: 'Service Business Logic Test',
    3: 'PGlite Integration Test',
    4: 'React Component Unit Test',
    5: 'tRPC Router Test',
    6: 'Permission/Auth Test',
    7: 'RLS Policy Test',
    8: 'Schema/Database Constraint Test',
  };
  return names[archetype] || 'Unknown';
}

function getSeverityIcon(severity) {
  switch (severity) {
    case 'critical': return '🔥';
    case 'high': return '⚠️';
    case 'medium': return '⚡';
    case 'low': return 'ℹ️';
    default: return '•';
  }
}

function showHelp() {
  console.log(`
🧪 Test Archetype Validator

Validates test files against the 8 testing archetypes and checks for:
• Memory safety violations (PGlite patterns that cause lockups)
• RLS context management compliance  
• Archetype pattern adherence
• Import structure correctness
• Error handling best practices

USAGE:
  node scripts/validate-test-archetype.cjs <file>              Validate single file
  node scripts/validate-test-archetype.cjs <pattern>          Validate files matching pattern
  node scripts/validate-test-archetype.cjs --all              Validate all test files

OPTIONS:
  --all, -a         Validate all test files in the project
  --verbose, -v     Show detailed validation output
  --report, -r      Generate detailed report with file breakdown
  --help, -h        Show this help message

EXAMPLES:
  node scripts/validate-test-archetype.cjs src/services/__tests__/userService.test.ts
  node scripts/validate-test-archetype.cjs "src/**/*.test.ts" --verbose
  node scripts/validate-test-archetype.cjs --all --report

EXIT CODES:
  0 - All tests pass validation
  1 - Critical or high priority errors found
`);
}

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main };