#!/usr/bin/env tsx
/**
 * Unified Codemod Runner - Phase 0 Infrastructure
 * Central orchestrator for safe, observable, and reversible code transformations
 * 
 * This runner provides:
 * - Dry-run capabilities with detailed analysis
 * - Batch processing with configurable limits
 * - Git-based safety and rollback mechanisms
 * - Comprehensive error handling and reporting
 * - Progress tracking and performance monitoring
 */

import { performance } from "perf_hooks";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { glob } from "glob";

/**
 * Configuration for a codemod execution
 */
export interface CodemodConfig {
  /** Unique identifier for the codemod */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** File patterns to target (glob patterns) */
  targetPatterns: string[];
  
  /** Path to the transformation file */
  transform: string;
  
  /** Whether this is a dry-run (no file modifications) */
  dryRun: boolean;
  
  /** Maximum number of files to process in one batch */
  batchSize: number;
  
  /** Maximum total files to process (0 = no limit) */
  maxFiles: number;
  
  /** Custom parser for jscodeshift */
  parser?: 'babel' | 'tsx' | 'ts' | 'flow';
  
  /** Additional options to pass to the transformer */
  options?: Record<string, any>;
}

/**
 * Error details for a transformation failure
 */
export interface CodemodError {
  /** File path where the error occurred */
  file: string;
  
  /** Error message */
  message: string;
  
  /** Error type/category */
  type: 'syntax-error' | 'transformation-error' | 'validation-error' | 'unknown';
  
  /** Line number if available */
  line?: number;
  
  /** Original error object */
  originalError?: Error;
}

/**
 * Summary of transformation results
 */
export interface TransformationSummary {
  /** Total files that matched the target patterns */
  totalTargetFiles: number;
  
  /** Files that were actually processed */
  filesProcessed: number;
  
  /** Files that were modified by the transformation */
  filesModified: number;
  
  /** Files that were skipped (no changes needed) */
  filesSkipped: number;
  
  /** Duration of the transformation in milliseconds */
  durationMs: number;
  
  /** Any warnings generated during transformation */
  warnings: string[];
}

/**
 * Result of a codemod execution
 */
export interface CodemodResult {
  /** Configuration used for this execution */
  config: CodemodConfig;
  
  /** Summary statistics */
  summary: TransformationSummary;
  
  /** Any errors that occurred */
  errors: CodemodError[];
  
  /** Success flag */
  success: boolean;
  
  /** Snapshot ID for rollback (if applicable) */
  snapshotId?: string;
  
  /** Detailed execution log */
  executionLog: string[];
}

/**
 * Validation result for pre-flight checks
 */
export interface ValidationResult {
  /** Whether the codemod can be safely executed */
  valid: boolean;
  
  /** List of validation issues found */
  issues: ValidationIssue[];
  
  /** Estimated number of files that would be affected */
  estimatedFiles: number;
}

export interface ValidationIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Issue message */
  message: string;
  
  /** Category of the issue */
  category: 'git' | 'files' | 'dependencies' | 'configuration';
  
  /** Suggested resolution */
  suggestion?: string;
}

/**
 * Main codemod runner class
 */
export class CodemodRunner {
  private executionLog: string[] = [];
  
  constructor(private verbose: boolean = false) {}

  /**
   * Execute a codemod transformation
   */
  async runTransformation(config: CodemodConfig): Promise<CodemodResult> {
    const startTime = performance.now();
    this.log(`Starting codemod execution: ${config.name}`);
    
    const result: CodemodResult = {
      config,
      summary: {
        totalTargetFiles: 0,
        filesProcessed: 0,
        filesModified: 0,
        filesSkipped: 0,
        durationMs: 0,
        warnings: [],
      },
      errors: [],
      success: false,
      executionLog: [],
    };

    try {
      // Step 1: Validate the transformation can be executed
      this.log("Validating transformation prerequisites...");
      const validation = await this.validateTransformation(config);
      
      if (!validation.valid) {
        const errorIssues = validation.issues.filter(issue => issue.severity === 'error');
        result.errors.push({
          file: '',
          message: `Validation failed: ${errorIssues.map(i => i.message).join(', ')}`,
          type: 'validation-error',
        });
        return result;
      }

      // Log warnings
      const warnings = validation.issues.filter(issue => issue.severity === 'warning');
      warnings.forEach(warning => {
        this.log(`Warning: ${warning.message}`, 'warn');
        result.summary.warnings.push(warning.message);
      });

      // Step 2: Discover target files
      this.log("Discovering target files...");
      const targetFiles = await this.discoverTargetFiles(config.targetPatterns);
      result.summary.totalTargetFiles = targetFiles.length;
      
      if (targetFiles.length === 0) {
        this.log("No files found matching target patterns");
        result.success = true; // Not an error, just nothing to do
        return result;
      }

      // Apply file limit if specified
      const filesToProcess = config.maxFiles > 0 
        ? targetFiles.slice(0, config.maxFiles)
        : targetFiles;
      
      this.log(`Found ${targetFiles.length} target files, processing ${filesToProcess.length}`);

      // Step 3: Create safety snapshot if not dry-run
      let snapshotId: string | undefined;
      if (!config.dryRun) {
        this.log("Creating safety snapshot...");
        snapshotId = await this.createSafetySnapshot();
        result.snapshotId = snapshotId;
      }

      // Step 4: Execute transformation in batches
      this.log(`Executing transformation in batches of ${config.batchSize}...`);
      const batchResults = await this.processInBatches(filesToProcess, config);
      
      // Aggregate results
      result.summary.filesProcessed = batchResults.reduce((sum, batch) => sum + batch.filesProcessed, 0);
      result.summary.filesModified = batchResults.reduce((sum, batch) => sum + batch.filesModified, 0);
      result.summary.filesSkipped = batchResults.reduce((sum, batch) => sum + batch.filesSkipped, 0);
      
      // Collect errors from all batches
      batchResults.forEach(batch => {
        result.errors.push(...batch.errors);
      });

      // Step 5: Validate results if files were modified
      if (!config.dryRun && result.summary.filesModified > 0) {
        this.log("Validating transformation results...");
        const postValidation = await this.validateTransformationResults();
        
        if (!postValidation.success) {
          this.log("Post-transformation validation failed, rolling back...", 'error');
          if (snapshotId) {
            await this.rollbackTransformation(snapshotId);
          }
          result.errors.push({
            file: '',
            message: `Post-transformation validation failed: ${postValidation.message}`,
            type: 'validation-error',
          });
          return result;
        }
      }

      result.success = result.errors.length === 0;
      
      if (result.success) {
        this.log(`Transformation completed successfully!`);
        this.log(`  Files processed: ${result.summary.filesProcessed}`);
        this.log(`  Files modified: ${result.summary.filesModified}`);
        if (config.dryRun) {
          this.log(`  (Dry-run mode: no files were actually modified)`);
        }
      } else {
        this.log(`Transformation completed with ${result.errors.length} errors`, 'error');
      }

    } catch (error) {
      this.log(`Unexpected error during transformation: ${error}`, 'error');
      result.errors.push({
        file: '',
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        type: 'unknown',
        originalError: error instanceof Error ? error : undefined,
      });
    } finally {
      result.summary.durationMs = Math.round(performance.now() - startTime);
      result.executionLog = [...this.executionLog];
      this.log(`Total execution time: ${result.summary.durationMs}ms`);
    }

    return result;
  }

  /**
   * Validate that a transformation can be safely executed
   */
  async validateTransformation(config: CodemodConfig): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      issues: [],
      estimatedFiles: 0,
    };

    try {
      // Check Git working directory
      try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
          result.issues.push({
            severity: 'warning',
            message: 'Working directory has uncommitted changes. Consider committing or stashing before transformation.',
            category: 'git',
            suggestion: 'Run `git stash` or `git commit` before proceeding',
          });
        }
      } catch (error) {
        result.issues.push({
          severity: 'warning',
          message: 'Not in a Git repository or Git not available',
          category: 'git',
        });
      }

      // Check that transform file exists
      const transformPath = path.resolve(config.transform);
      if (!fs.existsSync(transformPath)) {
        result.issues.push({
          severity: 'error',
          message: `Transform file not found: ${transformPath}`,
          category: 'files',
        });
        result.valid = false;
      }

      // Estimate target files
      try {
        const targetFiles = await this.discoverTargetFiles(config.targetPatterns);
        result.estimatedFiles = targetFiles.length;
        
        if (targetFiles.length === 0) {
          result.issues.push({
            severity: 'info',
            message: 'No files found matching target patterns',
            category: 'files',
          });
        } else if (targetFiles.length > 100) {
          result.issues.push({
            severity: 'warning',
            message: `Large number of files (${targetFiles.length}) will be processed. Consider using maxFiles limit.`,
            category: 'configuration',
            suggestion: 'Use maxFiles option to limit scope for initial testing',
          });
        }
      } catch (error) {
        result.issues.push({
          severity: 'error',
          message: `Failed to discover target files: ${error}`,
          category: 'files',
        });
        result.valid = false;
      }

      // Check TypeScript compilation
      try {
        execSync('npm run typecheck', { stdio: 'pipe' });
      } catch (error) {
        result.issues.push({
          severity: 'warning',
          message: 'TypeScript compilation errors exist. Transformation may fail or introduce new errors.',
          category: 'dependencies',
          suggestion: 'Fix TypeScript errors before running transformation',
        });
      }

    } catch (error) {
      result.issues.push({
        severity: 'error',
        message: `Validation error: ${error}`,
        category: 'configuration',
      });
      result.valid = false;
    }

    return result;
  }

  /**
   * Roll back a transformation using snapshot ID
   */
  async rollbackTransformation(snapshotId: string): Promise<void> {
    this.log(`Rolling back transformation using snapshot: ${snapshotId}`);
    
    try {
      // For Git stash-based snapshots
      if (snapshotId.startsWith('stash@')) {
        execSync(`git stash pop ${snapshotId}`, { stdio: 'pipe' });
        this.log("Successfully restored from Git stash");
      } else {
        // For commit-based snapshots
        execSync(`git reset --hard ${snapshotId}`, { stdio: 'pipe' });
        this.log("Successfully reset to snapshot commit");
      }
    } catch (error) {
      this.log(`Failed to rollback transformation: ${error}`, 'error');
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Discover files matching the target patterns
   */
  private async discoverTargetFiles(patterns: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          absolute: true,
        });
        allFiles.push(...files);
      } catch (error) {
        throw new Error(`Failed to match pattern "${pattern}": ${error}`);
      }
    }
    
    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  /**
   * Create a safety snapshot before transformation
   */
  private async createSafetySnapshot(): Promise<string> {
    try {
      // Create a Git stash with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const stashMessage = `codemod-snapshot-${timestamp}`;
      
      execSync(`git add .`, { stdio: 'pipe' });
      execSync(`git stash push -m "${stashMessage}"`, { stdio: 'pipe' });
      
      // Get the stash reference
      const stashOutput = execSync('git stash list --oneline -1', { encoding: 'utf8' });
      const stashRef = stashOutput.split(':')[0];
      
      return stashRef || `stash@{0}`;
    } catch (error) {
      throw new Error(`Failed to create safety snapshot: ${error}`);
    }
  }

  /**
   * Process files in batches to manage memory and provide progress updates
   */
  private async processInBatches(
    files: string[], 
    config: CodemodConfig
  ): Promise<BatchProcessingResult[]> {
    const batches: string[][] = [];
    
    // Split files into batches
    for (let i = 0; i < files.length; i += config.batchSize) {
      batches.push(files.slice(i, i + config.batchSize));
    }
    
    this.log(`Processing ${files.length} files in ${batches.length} batches`);
    
    const results: BatchProcessingResult[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} files)...`);
      
      const batchResult = await this.processBatch(batch, config);
      results.push(batchResult);
      
      this.log(`Batch ${i + 1} complete: ${batchResult.filesModified} modified, ${batchResult.errors.length} errors`);
    }
    
    return results;
  }

  /**
   * Process a single batch of files
   */
  private async processBatch(
    files: string[], 
    config: CodemodConfig
  ): Promise<BatchProcessingResult> {
    const result: BatchProcessingResult = {
      filesProcessed: 0,
      filesModified: 0,
      filesSkipped: 0,
      errors: [],
    };

    for (const file of files) {
      try {
        const fileResult = await this.processFile(file, config);
        result.filesProcessed++;
        
        if (fileResult.modified) {
          result.filesModified++;
        } else {
          result.filesSkipped++;
        }
        
        if (fileResult.error) {
          result.errors.push(fileResult.error);
        }
        
      } catch (error) {
        result.errors.push({
          file,
          message: error instanceof Error ? error.message : String(error),
          type: 'unknown',
          originalError: error instanceof Error ? error : undefined,
        });
      }
    }

    return result;
  }

  /**
   * Process a single file through the transformation
   */
  private async processFile(
    file: string, 
    config: CodemodConfig
  ): Promise<{ modified: boolean; error?: CodemodError }> {
    try {
      // Build jscodeshift command
      const transformPath = path.resolve(config.transform);
      const parser = config.parser || 'tsx';
      
      let command = `npx jscodeshift`;
      command += ` -t "${transformPath}"`;
      command += ` "${file}"`;
      command += ` --parser=${parser}`;
      
      if (config.dryRun) {
        command += ' --dry';
      }
      
      // Add any additional options
      if (config.options) {
        for (const [key, value] of Object.entries(config.options)) {
          command += ` --${key}=${value}`;
        }
      }
      
      // Execute the transformation
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      // Parse jscodeshift output to determine if file was modified
      const modified = !output.includes('Skipping') && !output.includes('0 ok');
      
      return { modified };
      
    } catch (error) {
      return {
        modified: false,
        error: {
          file,
          message: error instanceof Error ? error.message : String(error),
          type: 'transformation-error',
          originalError: error instanceof Error ? error : undefined,
        },
      };
    }
  }

  /**
   * Validate transformation results
   */
  private async validateTransformationResults(): Promise<{ success: boolean; message?: string }> {
    try {
      // Run TypeScript compilation check
      execSync('npm run typecheck', { stdio: 'pipe' });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: `TypeScript compilation failed: ${error}` 
      };
    }
  }

  /**
   * Log a message with optional level
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    this.executionLog.push(logMessage);
    
    if (this.verbose) {
      if (level === 'error') {
        console.error(logMessage);
      } else if (level === 'warn') {
        console.warn(logMessage);
      } else {
        console.log(logMessage);
      }
    }
  }
}

/**
 * Result of processing a batch of files
 */
interface BatchProcessingResult {
  filesProcessed: number;
  filesModified: number;
  filesSkipped: number;
  errors: CodemodError[];
}

/**
 * CLI interface for the runner
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Unified Codemod Runner

Usage:
  tsx scripts/codemods/runner.ts <command> [options]

Commands:
  run <codemod-name>     Execute a codemod transformation
  validate <codemod-name> Validate transformation prerequisites
  rollback <snapshot-id>  Roll back to a previous snapshot

Options:
  --dry-run              Preview changes without modifying files
  --batch-size <n>       Files per batch (default: 10)
  --max-files <n>        Maximum files to process (default: unlimited)
  --verbose              Enable verbose logging
  --help                 Show this help message

Examples:
  tsx scripts/codemods/runner.ts run migrate-dal-functions --dry-run
  tsx scripts/codemods/runner.ts validate migrate-dal-functions
  tsx scripts/codemods/runner.ts rollback stash@{0}
    `);
    process.exit(0);
  }

  const command = args[0];
  const runner = new CodemodRunner(args.includes('--verbose'));

  try {
    if (command === 'run') {
      const codemodName = args[1];
      if (!codemodName) {
        console.error('Error: Codemod name is required');
        process.exit(1);
      }

      // Build configuration from command line args
      const config: CodemodConfig = {
        name: codemodName,
        description: `Execute ${codemodName} transformation`,
        targetPatterns: [], // Will be set by registry
        transform: `./scripts/codemods/${codemodName}.ts`,
        dryRun: args.includes('--dry-run'),
        batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
        maxFiles: parseInt(args.find(arg => arg.startsWith('--max-files='))?.split('=')[1] || '0'),
        parser: 'tsx',
      };

      // Set target patterns based on known codemods
      if (codemodName === 'migrate-dal-functions') {
        config.targetPatterns = ['src/lib/dal/*.ts'];
      } else {
        console.error(`Unknown codemod: ${codemodName}`);
        process.exit(1);
      }

      const result = await runner.runTransformation(config);
      
      if (result.success) {
        console.log('✅ Transformation completed successfully');
      } else {
        console.log('❌ Transformation failed');
        result.errors.forEach(error => {
          console.error(`  ${error.file}: ${error.message}`);
        });
        process.exit(1);
      }

    } else if (command === 'rollback') {
      const snapshotId = args[1];
      if (!snapshotId) {
        console.error('Error: Snapshot ID is required');
        process.exit(1);
      }

      await runner.rollbackTransformation(snapshotId);
      console.log('✅ Rollback completed successfully');

    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}