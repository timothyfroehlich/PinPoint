#!/usr/bin/env tsx
/**
 * Codemod CLI - Phase 0 Infrastructure
 * User-friendly command-line interface for codemod operations
 * 
 * This CLI provides:
 * - Easy codemod discovery and execution
 * - Integrated dry-run analysis
 * - Registry management
 * - Safety features and rollback
 */

import { Command } from 'commander';
import { CodemodRunner } from './runner';
import { createDryRunAnalyzer } from './dry-run-analyzer';
import { createRegistryManager, defaultRegistryManager } from './registry';
import { createGitSafetyManager } from './utils/git-safety';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI program setup
 */
const program = new Command();

program
  .name('codemod')
  .description('PinPoint Codemod Harness - Safe code transformations')
  .version('1.0.0');

/**
 * List available codemods
 */
program
  .command('list')
  .description('List all available codemods')
  .option('-c, --category <category>', 'Filter by category')
  .option('-r, --risk <level>', 'Filter by risk level')
  .option('--verbose', 'Show detailed information')
  .action(async (options) => {
    const registry = defaultRegistryManager;
    
    let codemods = registry.listAvailableCodemods();
    
    // Apply filters
    if (options.category) {
      codemods = registry.getCodemodsByCategory(options.category);
    }
    
    if (options.risk) {
      codemods = registry.getCodemodsByRisk(options.risk);
    }
    
    if (codemods.length === 0) {
      console.log('No codemods found matching criteria.');
      return;
    }
    
    console.log(`\nAvailable Codemods (${codemods.length}):\n`);
    
    codemods.forEach(codemod => {
      const riskEmoji = codemod.estimatedRisk === 'low' ? '🟢' :
                       codemod.estimatedRisk === 'medium' ? '🟡' :
                       codemod.estimatedRisk === 'high' ? '🟠' : '🔴';
      
      console.log(`${riskEmoji} ${codemod.name} (${codemod.id})`);
      console.log(`   Risk: ${codemod.estimatedRisk} | Category: ${codemod.category} | Version: ${codemod.version}`);
      
      if (options.verbose) {
        console.log(`   Description: ${codemod.description}`);
        console.log(`   Targets: ${codemod.targetPatterns.join(', ')}`);
        if (codemod.dependencies.length > 0) {
          console.log(`   Dependencies: ${codemod.dependencies.join(', ')}`);
        }
      }
      
      console.log('');
    });
  });

/**
 * Show detailed information about a specific codemod
 */
program
  .command('info <codemodId>')
  .description('Show detailed information about a specific codemod')
  .action(async (codemodId) => {
    const registry = defaultRegistryManager;
    const codemod = registry.getCodemod(codemodId);
    
    if (!codemod) {
      console.error(`❌ Codemod not found: ${codemodId}`);
      process.exit(1);
    }
    
    const riskEmoji = codemod.estimatedRisk === 'low' ? '🟢' :
                     codemod.estimatedRisk === 'medium' ? '🟡' :
                     codemod.estimatedRisk === 'high' ? '🟠' : '🔴';
    
    console.log(`\n${riskEmoji} ${codemod.name} (${codemod.id})\n`);
    console.log(`Version: ${codemod.version}`);
    console.log(`Category: ${codemod.category}`);
    console.log(`Risk Level: ${codemod.estimatedRisk}`);
    console.log(`Parser: ${codemod.parser}`);
    console.log(`Dry-run Support: ${codemod.dryRunSupport ? '✅' : '❌'}`);
    console.log(`Rollback Support: ${codemod.rollbackSupport ? '✅' : '❌'}`);
    console.log(`\nDescription:`);
    console.log(codemod.description);
    
    console.log(`\nTarget Patterns:`);
    codemod.targetPatterns.forEach(pattern => {
      console.log(`  - ${pattern}`);
    });
    
    if (codemod.dependencies.length > 0) {
      console.log(`\nDependencies:`);
      codemod.dependencies.forEach(dep => {
        console.log(`  - ${dep}`);
      });
    }
    
    if (codemod.examples && codemod.examples.length > 0) {
      console.log(`\nUsage Examples:`);
      codemod.examples.forEach(example => {
        console.log(`  ${example}`);
      });
    }
    
    if (codemod.limitations && codemod.limitations.length > 0) {
      console.log(`\nLimitations:`);
      codemod.limitations.forEach(limitation => {
        console.log(`  - ${limitation}`);
      });
    }
    
    if (codemod.performance) {
      console.log(`\nPerformance:`);
      console.log(`  Files/second: ${codemod.performance.filesPerSecond || 'N/A'}`);
      console.log(`  Memory usage: ${codemod.performance.memoryUsageMB || 'N/A'} MB`);
      console.log(`  CPU intensive: ${codemod.performance.cpuIntensive ? 'Yes' : 'No'}`);
    }
    
    console.log(`\nCreated: ${codemod.createdAt.toLocaleDateString()}`);
    console.log(`Updated: ${codemod.updatedAt.toLocaleDateString()}`);
    
    // Check prerequisites
    const validation = registry.validateExecutionPrerequisites(codemodId);
    if (!validation.valid) {
      console.log(`\n⚠️ Prerequisites Issues:`);
      validation.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }
  });

/**
 * Run dry-run analysis
 */
program
  .command('dry-run <codemodId>')
  .description('Analyze transformation impact without making changes')
  .option('--max-files <number>', 'Maximum files to analyze', '20')
  .option('--output <file>', 'Save analysis report to file')
  .action(async (codemodId, options) => {
    const registry = defaultRegistryManager;
    const codemod = registry.getCodemod(codemodId);
    
    if (!codemod) {
      console.error(`❌ Codemod not found: ${codemodId}`);
      process.exit(1);
    }
    
    if (!codemod.dryRunSupport) {
      console.error(`❌ Codemod ${codemodId} does not support dry-run analysis`);
      process.exit(1);
    }
    
    console.log(`🔍 Running dry-run analysis for: ${codemod.name}`);
    
    try {
      const analyzer = createDryRunAnalyzer();
      
      const config = {
        codemodName: codemod.id,
        targetPatterns: codemod.targetPatterns,
        transformPath: path.resolve('scripts/codemods', codemod.transformFile),
        maxFiles: parseInt(options.maxFiles),
        parser: codemod.parser,
      };
      
      const result = await analyzer.analyzePlannedTransformation(config);
      const report = await analyzer.generateTransformationReport(result);
      
      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(`📝 Analysis report saved to: ${options.output}`);
      } else {
        console.log('\n' + report);
      }
      
      // Summary
      console.log('\n📊 Analysis Summary:');
      console.log(`Files analyzed: ${result.targetFiles.length}`);
      console.log(`Changes planned: ${result.plannedChanges.length}`);
      console.log(`Files affected: ${result.estimatedImpact.filesAffected}`);
      console.log(`Complexity: ${result.estimatedImpact.complexity}`);
      console.log(`Recommendation: ${result.estimatedImpact.recommendedApproach}`);
      
      if (result.potentialIssues.length > 0) {
        const highRiskIssues = result.potentialIssues.filter(i => i.severity === 'high' || i.severity === 'critical');
        if (highRiskIssues.length > 0) {
          console.log(`\n⚠️ High-risk issues found: ${highRiskIssues.length}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Dry-run analysis failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Execute a codemod transformation
 */
program
  .command('run <codemodId>')
  .description('Execute a codemod transformation')
  .option('--dry-run', 'Preview changes without modifying files')
  .option('--batch-size <number>', 'Files per batch', '10')
  .option('--max-files <number>', 'Maximum files to process', '0')
  .option('--no-backup', 'Skip creating backup snapshot')
  .option('--force', 'Skip safety checks')
  .option('--verbose', 'Enable verbose logging')
  .action(async (codemodId, options) => {
    const registry = defaultRegistryManager;
    const codemod = registry.getCodemod(codemodId);
    
    if (!codemod) {
      console.error(`❌ Codemod not found: ${codemodId}`);
      process.exit(1);
    }
    
    // Validate prerequisites
    if (!options.force) {
      const validation = registry.validateExecutionPrerequisites(codemodId);
      if (!validation.valid) {
        console.error(`❌ Prerequisites check failed:`);
        validation.issues.forEach(issue => {
          console.error(`  - ${issue}`);
        });
        process.exit(1);
      }
    }
    
    // Check dependencies
    const dependencies = registry.getCodemodDependencies(codemodId);
    if (dependencies.length > 0) {
      console.log(`📋 Dependencies required: ${dependencies.join(', ')}`);
      console.log(`   Make sure these have been run first, or use 'plan' command for execution order.`);
    }
    
    console.log(`🚀 ${options.dryRun ? 'Dry-running' : 'Executing'}: ${codemod.name}`);
    
    try {
      const runner = new CodemodRunner(options.verbose);
      
      const config = {
        name: codemod.id,
        description: codemod.description,
        targetPatterns: codemod.targetPatterns,
        transform: path.resolve('scripts/codemods', codemod.transformFile),
        dryRun: options.dryRun,
        batchSize: parseInt(options.batchSize),
        maxFiles: parseInt(options.maxFiles),
        parser: codemod.parser,
      };
      
      const result = await runner.runTransformation(config);
      
      if (result.success) {
        console.log(`✅ Transformation completed successfully!`);
        console.log(`   Files processed: ${result.summary.filesProcessed}`);
        console.log(`   Files modified: ${result.summary.filesModified}`);
        console.log(`   Duration: ${result.summary.durationMs}ms`);
        
        if (result.snapshotId && !options.dryRun) {
          console.log(`   Snapshot ID: ${result.snapshotId} (for rollback)`);
        }
        
        if (result.summary.warnings.length > 0) {
          console.log(`\n⚠️ Warnings:`);
          result.summary.warnings.forEach(warning => {
            console.log(`   - ${warning}`);
          });
        }
      } else {
        console.error(`❌ Transformation failed with ${result.errors.length} errors:`);
        result.errors.forEach(error => {
          console.error(`   ${error.file}: ${error.message}`);
        });
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Execution failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Plan execution order for multiple codemods
 */
program
  .command('plan <codemodIds...>')
  .description('Plan execution order for multiple codemods')
  .option('--show-deps', 'Show detailed dependency information')
  .action(async (codemodIds, options) => {
    const registry = defaultRegistryManager;
    
    // Validate all codemods exist
    const invalidIds = codemodIds.filter(id => !registry.validateCodemodExists(id));
    if (invalidIds.length > 0) {
      console.error(`❌ Unknown codemods: ${invalidIds.join(', ')}`);
      process.exit(1);
    }
    
    try {
      const executionOrder = registry.planExecutionOrder(codemodIds);
      
      console.log(`📋 Execution Plan for: ${codemodIds.join(', ')}\n`);
      
      executionOrder.forEach((id, index) => {
        const codemod = registry.getCodemod(id)!;
        const riskEmoji = codemod.estimatedRisk === 'low' ? '🟢' :
                         codemod.estimatedRisk === 'medium' ? '🟡' :
                         codemod.estimatedRisk === 'high' ? '🟠' : '🔴';
        
        console.log(`${index + 1}. ${riskEmoji} ${codemod.name} (${id})`);
        console.log(`   Risk: ${codemod.estimatedRisk} | Files: ~${codemod.targetPatterns.length} patterns`);
        
        if (options.showDeps && codemod.dependencies.length > 0) {
          console.log(`   Dependencies: ${codemod.dependencies.join(', ')}`);
        }
      });
      
      console.log(`\nTotal steps: ${executionOrder.length}`);
      console.log(`\nTo execute in order:`);
      executionOrder.forEach(id => {
        console.log(`  tsx scripts/codemods/cli.ts run ${id} --dry-run`);
      });
      
    } catch (error) {
      console.error(`❌ Planning failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * Rollback a transformation
 */
program
  .command('rollback <snapshotId>')
  .description('Roll back to a previous snapshot')
  .action(async (snapshotId) => {
    console.log(`🔄 Rolling back to snapshot: ${snapshotId}`);
    
    try {
      const gitSafety = createGitSafetyManager();
      await gitSafety.rollbackTransformation(snapshotId);
      
      console.log(`✅ Rollback completed successfully!`);
      
    } catch (error) {
      console.error(`❌ Rollback failed: ${error}`);
      process.exit(1);
    }
  });

/**
 * List available snapshots
 */
program
  .command('snapshots')
  .description('List available snapshots for rollback')
  .action(async () => {
    const gitSafety = createGitSafetyManager();
    
    try {
      const snapshots = await gitSafety.listSnapshots();
      
      if (snapshots.length === 0) {
        console.log('No snapshots found.');
        return;
      }
      
      console.log(`\nAvailable Snapshots (${snapshots.length}):\n`);
      
      snapshots.forEach(snapshot => {
        const typeEmoji = snapshot.type === 'stash' ? '📦' :
                         snapshot.type === 'branch' ? '🌿' : '📝';
        
        console.log(`${typeEmoji} ${snapshot.id} (${snapshot.type})`);
        console.log(`   ${snapshot.description}`);
        console.log(`   Created: ${snapshot.timestamp.toLocaleString()}`);
        console.log('');
      });
      
    } catch (error) {
      console.error(`❌ Failed to list snapshots: ${error}`);
      process.exit(1);
    }
  });

/**
 * Search codemods
 */
program
  .command('search <query>')
  .description('Search codemods by name, description, or tags')
  .action(async (query) => {
    const registry = defaultRegistryManager;
    const results = registry.searchCodemods(query);
    
    if (results.length === 0) {
      console.log(`No codemods found matching: "${query}"`);
      return;
    }
    
    console.log(`\nSearch Results for "${query}" (${results.length}):\n`);
    
    results.forEach(codemod => {
      const riskEmoji = codemod.estimatedRisk === 'low' ? '🟢' :
                       codemod.estimatedRisk === 'medium' ? '🟡' :
                       codemod.estimatedRisk === 'high' ? '🟠' : '🔴';
      
      console.log(`${riskEmoji} ${codemod.name} (${codemod.id})`);
      console.log(`   ${codemod.description}`);
      console.log(`   Tags: ${codemod.tags.join(', ')}`);
      console.log('');
    });
  });

/**
 * Generate registry report
 */
program
  .command('report')
  .description('Generate comprehensive registry report')
  .option('--output <file>', 'Save report to file')
  .action(async (options) => {
    const registry = defaultRegistryManager;
    const report = registry.generateRegistryReport();
    
    if (options.output) {
      fs.writeFileSync(options.output, report);
      console.log(`📝 Registry report saved to: ${options.output}`);
    } else {
      console.log(report);
    }
  });

// Parse command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}