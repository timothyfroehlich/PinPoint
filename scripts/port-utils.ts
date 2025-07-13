#!/usr/bin/env tsx

/**
 * Port utility for PinPoint worktree development
 * Generates unique ports based on workspace path to avoid conflicts
 * Falls back to standard defaults for non-worktree environments
 */

import { createHash } from "crypto";
import path from "path";
import fs from "fs";

interface PortConfiguration {
  nextPort?: number;
  prismaStudioPort?: number;
  databasePort?: number;
  databaseName: string;
  isWorktree: boolean;
  workspaceName?: string;
  portOffset?: number;
}

interface EnvironmentVariables {
  PORT?: string;
  PRISMA_STUDIO_PORT?: string;
  DATABASE_URL?: string;
}

/**
 * Generate a deterministic hash from workspace path
 */
function hashWorkspacePath(workspacePath: string): number {
  const hash = createHash("md5").update(workspacePath).digest("hex");
  // Convert first 8 chars to number and ensure it's positive
  return Math.abs(parseInt(hash.substring(0, 8), 16));
}

/**
 * Check if the given path is in a Git worktree
 * Worktrees have a .git file (not directory) that points to the actual git directory
 */
function isGitWorktree(workspacePath: string): boolean {
  try {
    const gitPath = path.join(workspacePath, ".git");

    // Check if .git exists and if it's a file (worktree) vs directory (main repo)
    if (fs.existsSync(gitPath)) {
      const stats = fs.statSync(gitPath);
      return stats.isFile(); // Worktrees have .git as a file, main repo has it as directory
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Calculate unique ports for a workspace
 */
function calculatePorts(
  workspacePath: string = process.cwd(),
): PortConfiguration {
  // Check if we're in a worktree environment using git commands
  const isWorktreeEnv = isGitWorktree(workspacePath);

  if (!isWorktreeEnv) {
    // Default behavior for main workspace, CI, or non-worktree environments
    return {
      nextPort: undefined, // Let Next.js use its default (3000) or PORT env var
      prismaStudioPort: undefined, // Let Prisma Studio use its default (5555)
      databasePort: undefined, // Let PostgreSQL use its default (5432)
      databaseName: "pinpoint", // Default database name
      isWorktree: false,
    };
  }

  // Generate unique ports for worktree environments
  const hash = hashWorkspacePath(workspacePath);
  const portOffset = (hash % 100) + 1; // 1-100 to avoid port 3000 collision

  // Extract workspace identifier from path for database naming
  const workspaceName = path
    .basename(workspacePath)
    .replace(/^PinPoint-/i, "")
    .replace(/^pinpoint-/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();

  return {
    nextPort: 3000 + portOffset,
    prismaStudioPort: 5555 + portOffset,
    databasePort: 5432 + portOffset,
    databaseName: `pinpoint_${workspaceName}`,
    isWorktree: true,
    workspaceName,
    portOffset,
  };
}

/**
 * Generate environment variables for the workspace
 */
function generateEnvVars(
  workspacePath: string = process.cwd(),
): EnvironmentVariables {
  const ports = calculatePorts(workspacePath);

  const envVars: EnvironmentVariables = {};

  // Only set port variables if we're in a worktree environment
  if (
    ports.isWorktree &&
    ports.nextPort &&
    ports.prismaStudioPort &&
    ports.databasePort
  ) {
    envVars.PORT = ports.nextPort.toString();
    envVars.PRISMA_STUDIO_PORT = ports.prismaStudioPort.toString();

    // Use environment variables for database credentials, with development defaults
    const dbUser = process.env.DB_USER || "postgres";
    const dbPassword = process.env.DB_PASSWORD || "password"; // Default to 'password' for consistency
    const dbHost = process.env.DB_HOST || "localhost";

    envVars.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${ports.databasePort}/${ports.databaseName}`;
  }

  return envVars;
}

/**
 * CLI interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const workspacePath = process.argv[3] || process.cwd();

  switch (command) {
    case "ports":
      console.log(JSON.stringify(calculatePorts(workspacePath), null, 2));
      break;

    case "env":
      const envVars = generateEnvVars(workspacePath);
      for (const [key, value] of Object.entries(envVars)) {
        console.log(`${key}=${value}`);
      }
      break;

    case "check":
      const ports = calculatePorts(workspacePath);
      console.log(`Workspace: ${workspacePath}`);
      console.log(`Is worktree: ${ports.isWorktree}`);
      if (ports.isWorktree) {
        console.log(`Next.js port: ${ports.nextPort}`);
        console.log(`Prisma Studio port: ${ports.prismaStudioPort}`);
        console.log(
          `Database: ${ports.databaseName} on port ${ports.databasePort}`,
        );
      } else {
        console.log(
          "Using default ports (Next.js: 3000, Prisma Studio: 5555, PostgreSQL: 5432)",
        );
      }
      break;

    default:
      console.log("Usage:");
      console.log(
        "  node port-utils.js ports [workspace-path]     - Get port configuration",
      );
      console.log(
        "  node port-utils.js env [workspace-path]       - Get environment variables",
      );
      console.log(
        "  node port-utils.js check [workspace-path]     - Check port assignment",
      );
      break;
  }
}

export { calculatePorts, generateEnvVars, hashWorkspacePath };
