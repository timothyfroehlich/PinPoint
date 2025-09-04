/**
 * Git Safety Manager - Phase 0 Infrastructure
 * Git-based backup and rollback system for safe code transformations
 * 
 * This module provides:
 * - Pre-transformation branch creation
 * - Git stash-based snapshots
 * - Working directory validation
 * - Safe rollback mechanisms
 * - Branch management utilities
 */

import { execSync, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

/**
 * Git safety configuration
 */
export interface GitSafetyConfig {
  /** Whether to create a branch for the transformation */
  createBranch: boolean;
  
  /** Whether to create a stash snapshot */
  createStash: boolean;
  
  /** Require clean working directory */
  requireCleanWorkingDir: boolean;
  
  /** Custom branch prefix */
  branchPrefix?: string;
  
  /** Custom stash message prefix */
  stashPrefix?: string;
}

/**
 * Git snapshot information
 */
export interface GitSnapshot {
  /** Snapshot ID (branch name, stash ref, or commit hash) */
  id: string;
  
  /** Snapshot type */
  type: 'branch' | 'stash' | 'commit';
  
  /** Human-readable description */
  description: string;
  
  /** Timestamp when snapshot was created */
  timestamp: Date;
  
  /** Files that were changed (if available) */
  changedFiles?: string[];
}

/**
 * Git repository status
 */
export interface GitStatus {
  /** Whether working directory is clean */
  isClean: boolean;
  
  /** Current branch name */
  currentBranch: string;
  
  /** Uncommitted changes */
  changes: {
    staged: string[];
    unstaged: string[];
    untracked: string[];
  };
  
  /** Whether we're in a Git repository */
  isGitRepo: boolean;
}

/**
 * Main Git safety manager class
 */
export class GitSafetyManager {
  private config: GitSafetyConfig;
  
  constructor(config: GitSafetyConfig = {
    createBranch: true,
    createStash: true,
    requireCleanWorkingDir: true,
  }) {
    this.config = config;
  }

  /**
   * Create a transformation branch for safe development
   */
  async createTransformationBranch(codemodName: string): Promise<string> {
    await this.validateGitRepository();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const prefix = this.config.branchPrefix || 'codemod';
    const branchName = `${prefix}/${codemodName}-${timestamp}`;
    
    try {
      // Ensure we're on a clean working directory if required
      if (this.config.requireCleanWorkingDir) {
        await this.validateCleanWorkingDirectory();
      }
      
      // Create and switch to new branch
      await this.executeGitCommand(`git checkout -b ${branchName}`);
      
      console.log(`Created transformation branch: ${branchName}`);
      return branchName;
      
    } catch (error) {
      throw new Error(`Failed to create transformation branch: ${error}`);
    }
  }

  /**
   * Create a pre-transformation snapshot
   */
  async createPreTransformSnapshot(description?: string): Promise<GitSnapshot> {
    await this.validateGitRepository();
    
    const timestamp = new Date();
    const prefix = this.config.stashPrefix || 'codemod-snapshot';
    const stashMessage = description || `${prefix}-${timestamp.toISOString()}`;
    
    try {
      // Get current status
      const status = await this.getGitStatus();
      
      if (status.isClean && !this.config.createBranch) {
        // If working directory is clean and we're not creating a branch,
        // create a commit snapshot instead
        return await this.createCommitSnapshot(stashMessage);
      }
      
      // Stage all changes
      await this.executeGitCommand('git add .');
      
      // Create stash
      await this.executeGitCommand(`git stash push -m "${stashMessage}"`);
      
      // Get stash reference
      const stashOutput = await this.executeGitCommand('git stash list --oneline -1');
      const stashRef = stashOutput.split(':')[0] || 'stash@{0}';
      
      return {
        id: stashRef,
        type: 'stash',
        description: stashMessage,
        timestamp,
        changedFiles: [...status.changes.staged, ...status.changes.unstaged],
      };
      
    } catch (error) {
      throw new Error(`Failed to create pre-transformation snapshot: ${error}`);
    }
  }

  /**
   * Validate that working directory is clean
   */
  async validateCleanWorkingDirectory(): Promise<void> {
    const status = await this.getGitStatus();
    
    if (!status.isClean) {
      const allChanges = [
        ...status.changes.staged,
        ...status.changes.unstaged,
        ...status.changes.untracked,
      ];
      
      throw new Error(
        `Working directory is not clean. Found ${allChanges.length} uncommitted changes:\n` +
        allChanges.slice(0, 10).map(file => `  - ${file}`).join('\n') +
        (allChanges.length > 10 ? `\n  ... and ${allChanges.length - 10} more` : '') +
        '\n\nPlease commit or stash changes before running transformation.'
      );
    }
  }

  /**
   * Get current Git repository status
   */
  async getGitStatus(): Promise<GitStatus> {
    try {
      await this.validateGitRepository();
      
      // Get current branch
      const currentBranch = await this.executeGitCommand('git branch --show-current');
      
      // Get status
      const statusOutput = await this.executeGitCommand('git status --porcelain');
      
      const changes = {
        staged: [] as string[],
        unstaged: [] as string[],
        untracked: [] as string[],
      };
      
      statusOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const status = line.slice(0, 2);
          const file = line.slice(3);
          
          if (status[0] !== ' ' && status[0] !== '?') {
            changes.staged.push(file);
          }
          if (status[1] !== ' ') {
            changes.unstaged.push(file);
          }
          if (status === '??') {
            changes.untracked.push(file);
          }
        }
      });
      
      return {
        isClean: statusOutput.trim() === '',
        currentBranch: currentBranch.trim(),
        changes,
        isGitRepo: true,
      };
      
    } catch (error) {
      return {
        isClean: false,
        currentBranch: '',
        changes: { staged: [], unstaged: [], untracked: [] },
        isGitRepo: false,
      };
    }
  }

  /**
   * Restore from a Git snapshot
   */
  async rollbackTransformation(snapshotId: string): Promise<void> {
    await this.validateGitRepository();
    
    try {
      if (snapshotId.startsWith('stash@')) {
        // Restore from stash
        await this.rollbackFromStash(snapshotId);
      } else if (snapshotId.match(/^[a-f0-9]{7,40}$/)) {
        // Restore from commit hash
        await this.rollbackFromCommit(snapshotId);
      } else if (snapshotId.startsWith('codemod/')) {
        // Switch back from branch
        await this.rollbackFromBranch(snapshotId);
      } else {
        throw new Error(`Unknown snapshot format: ${snapshotId}`);
      }
      
      console.log(`Successfully rolled back to snapshot: ${snapshotId}`);
      
    } catch (error) {
      throw new Error(`Failed to rollback transformation: ${error}`);
    }
  }

  /**
   * List available snapshots
   */
  async listSnapshots(): Promise<GitSnapshot[]> {
    const snapshots: GitSnapshot[] = [];
    
    try {
      await this.validateGitRepository();
      
      // List stashes
      const stashOutput = await this.executeGitCommand('git stash list --oneline');
      stashOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const [ref, ...messageParts] = line.split(': ');
          const message = messageParts.join(': ');
          
          if (message.includes('codemod-snapshot') || message.includes(this.config.stashPrefix || 'codemod-snapshot')) {
            snapshots.push({
              id: ref,
              type: 'stash',
              description: message,
              timestamp: new Date(), // Approximation - Git doesn't store stash timestamps easily
            });
          }
        }
      });
      
      // List codemod branches
      const branchOutput = await this.executeGitCommand('git branch -a');
      const branchPrefix = this.config.branchPrefix || 'codemod';
      
      branchOutput.split('\n').forEach(line => {
        const branch = line.trim().replace(/^\*\s*/, '');
        if (branch.startsWith(branchPrefix + '/')) {
          snapshots.push({
            id: branch,
            type: 'branch',
            description: `Transformation branch: ${branch}`,
            timestamp: new Date(), // Could be enhanced with actual branch creation time
          });
        }
      });
      
    } catch (error) {
      console.warn(`Failed to list snapshots: ${error}`);
    }
    
    return snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clean up old snapshots
   */
  async cleanupOldSnapshots(daysToKeep: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      const snapshots = await this.listSnapshots();
      const oldSnapshots = snapshots.filter(snap => snap.timestamp < cutoffDate);
      
      for (const snapshot of oldSnapshots) {
        try {
          if (snapshot.type === 'stash') {
            await this.executeGitCommand(`git stash drop ${snapshot.id}`);
          } else if (snapshot.type === 'branch') {
            await this.executeGitCommand(`git branch -D ${snapshot.id}`);
          }
          console.log(`Cleaned up old snapshot: ${snapshot.id}`);
        } catch (error) {
          console.warn(`Failed to clean up snapshot ${snapshot.id}: ${error}`);
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to cleanup old snapshots: ${error}`);
    }
  }

  /**
   * Validate that current directory is a Git repository
   */
  async validateGitRepository(): Promise<void> {
    try {
      await this.executeGitCommand('git rev-parse --git-dir');
    } catch (error) {
      throw new Error('Not in a Git repository. Git-based safety features require a Git repository.');
    }
  }

  /**
   * Get changed files since snapshot
   */
  async getChangedFilesSinceSnapshot(snapshotId: string): Promise<string[]> {
    try {
      let command = '';
      
      if (snapshotId.startsWith('stash@')) {
        command = `git diff --name-only ${snapshotId}`;
      } else if (snapshotId.match(/^[a-f0-9]{7,40}$/)) {
        command = `git diff --name-only ${snapshotId}..HEAD`;
      } else {
        command = `git diff --name-only HEAD`;
      }
      
      const output = await this.executeGitCommand(command);
      return output.split('\n').filter(line => line.trim());
      
    } catch (error) {
      console.warn(`Failed to get changed files: ${error}`);
      return [];
    }
  }

  // Private helper methods

  private async rollbackFromStash(stashRef: string): Promise<void> {
    // Check if we need to reset working directory first
    const status = await this.getGitStatus();
    
    if (!status.isClean) {
      // Stash current changes to avoid conflicts
      await this.executeGitCommand('git stash push -m "pre-rollback-backup"');
    }
    
    // Apply the stash
    await this.executeGitCommand(`git stash pop ${stashRef}`);
  }

  private async rollbackFromCommit(commitHash: string): Promise<void> {
    // Check if there are uncommitted changes
    const status = await this.getGitStatus();
    
    if (!status.isClean) {
      throw new Error('Cannot rollback to commit with uncommitted changes. Please commit or stash changes first.');
    }
    
    // Reset to the commit
    await this.executeGitCommand(`git reset --hard ${commitHash}`);
  }

  private async rollbackFromBranch(branchName: string): Promise<void> {
    // Get the parent branch (typically main or the branch we came from)
    try {
      // Try to find the merge-base with main
      const mergeBase = await this.executeGitCommand(`git merge-base ${branchName} main`);
      
      // Switch back to main and reset to merge base
      await this.executeGitCommand('git checkout main');
      await this.executeGitCommand(`git reset --hard ${mergeBase.trim()}`);
      
      // Optionally delete the codemod branch
      await this.executeGitCommand(`git branch -D ${branchName}`);
      
    } catch (error) {
      // Fallback: just switch back to main
      await this.executeGitCommand('git checkout main');
    }
  }

  private async createCommitSnapshot(message: string): Promise<GitSnapshot> {
    try {
      // Create a commit with current state
      await this.executeGitCommand('git add .');
      await this.executeGitCommand(`git commit -m "${message}"`);
      
      // Get the commit hash
      const commitHash = await this.executeGitCommand('git rev-parse HEAD');
      
      // Get list of changed files
      const changedFiles = await this.executeGitCommand('git diff --name-only HEAD~1');
      
      return {
        id: commitHash.trim().slice(0, 7), // Short hash
        type: 'commit',
        description: message,
        timestamp: new Date(),
        changedFiles: changedFiles.split('\n').filter(line => line.trim()),
      };
      
    } catch (error) {
      throw new Error(`Failed to create commit snapshot: ${error}`);
    }
  }

  private async executeGitCommand(command: string): Promise<string> {
    try {
      const result = await execAsync(command, { 
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      return result.stdout.trim();
    } catch (error: any) {
      throw new Error(`Git command failed (${command}): ${error.message}`);
    }
  }
}

/**
 * Utility class for Git operations specific to codemod workflows
 */
export class CodemodGitWorkflow {
  private gitSafety: GitSafetyManager;
  
  constructor(config?: GitSafetyConfig) {
    this.gitSafety = new GitSafetyManager(config);
  }

  /**
   * Set up a complete safe transformation environment
   */
  async setupSafeTransformation(codemodName: string): Promise<{
    branchName?: string;
    snapshotId: string;
  }> {
    const result: { branchName?: string; snapshotId: string } = {
      snapshotId: '',
    };
    
    // Create branch if configured
    if (this.gitSafety['config'].createBranch) {
      result.branchName = await this.gitSafety.createTransformationBranch(codemodName);
    }
    
    // Create snapshot
    const snapshot = await this.gitSafety.createPreTransformSnapshot(
      `Pre-${codemodName}-transformation`
    );
    result.snapshotId = snapshot.id;
    
    return result;
  }

  /**
   * Complete a transformation and optionally merge back
   */
  async completeTransformation(
    snapshotId: string,
    branchName?: string,
    mergeBack: boolean = false
  ): Promise<void> {
    if (branchName && mergeBack) {
      try {
        // Switch to main branch
        await this.gitSafety['executeGitCommand']('git checkout main');
        
        // Merge the transformation branch
        await this.gitSafety['executeGitCommand'](`git merge ${branchName}`);
        
        // Delete the transformation branch
        await this.gitSafety['executeGitCommand'](`git branch -d ${branchName}`);
        
        console.log(`Successfully merged and cleaned up branch: ${branchName}`);
        
      } catch (error) {
        console.warn(`Failed to merge branch, leaving it for manual handling: ${error}`);
      }
    }
    
    // Clean up snapshot if it's a stash (commits and branches can be kept)
    if (snapshotId.startsWith('stash@')) {
      try {
        await this.gitSafety['executeGitCommand'](`git stash drop ${snapshotId}`);
        console.log(`Cleaned up transformation snapshot: ${snapshotId}`);
      } catch (error) {
        console.warn(`Failed to clean up snapshot: ${error}`);
      }
    }
  }
}

/**
 * Factory function for creating Git safety manager
 */
export function createGitSafetyManager(config?: GitSafetyConfig): GitSafetyManager {
  return new GitSafetyManager(config);
}