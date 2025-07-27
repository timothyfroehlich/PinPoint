#!/usr/bin/env tsx

/**
 * Port utility for PinPoint worktree development
 * Generates unique ports based on workspace path to avoid conflicts
 * Falls back to standard defaults for non-worktree environments
 */

import { createHash } from "crypto";
import path from "path";
import fs from "fs";
import { createConnection } from "net";

interface PortConfiguration {
  nextPort?: number | undefined;
  prismaStudioPort?: number | undefined;
  databasePort?: number | undefined;
  databaseName: string;
  isWorktree: boolean;
  workspaceName?: string | undefined;
  portOffset?: number | undefined;
}

interface EnvironmentVariables {
  PORT?: string;
  PRISMA_STUDIO_PORT?: string;
  DATABASE_URL?: string;
}

// Ephemeral port range (49152-65535)
const EPHEMERAL_PORT_START = 49152;
const EPHEMERAL_PORT_END = 65535;
const EPHEMERAL_PORT_RANGE = EPHEMERAL_PORT_END - EPHEMERAL_PORT_START + 1;

/**
 * Generate a deterministic hash from workspace path using SHA-256
 */
function hashWorkspacePath(workspacePath: string): number {
  const hash = createHash("sha256").update(workspacePath).digest("hex");
  // Convert first 8 chars to number and ensure it's positive
  return Math.abs(parseInt(hash.substring(0, 8), 16));
}

/**
 * Check if a port is available for use
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const connection = createConnection({ port, host: "localhost" });

    connection.on("connect", () => {
      connection.destroy();
      resolve(false); // Port is in use
    });

    connection.on("error", () => {
      resolve(true); // Port is available
    });

    // Set timeout to avoid hanging
    setTimeout(() => {
      connection.destroy();
      resolve(true); // Assume available if timeout
    }, 1000);
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(
  startPort: number,
  maxAttempts = 100,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (port > EPHEMERAL_PORT_END) {
      throw new Error(
        `No available ports found in ephemeral range after ${maxAttempts} attempts`,
      );
    }

    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(
    `No available ports found after ${maxAttempts} attempts starting from ${startPort}`,
  );
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

  // Generate unique ports for worktree environments using ephemeral range
  const hash = hashWorkspacePath(workspacePath);
  const portOffset = hash % EPHEMERAL_PORT_RANGE;
  const basePort = EPHEMERAL_PORT_START + portOffset;

  // Extract workspace identifier from path for database naming
  const workspaceName = path
    .basename(workspacePath)
    .replace(/^PinPoint-/i, "")
    .replace(/^pinpoint-/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();

  return {
    nextPort: basePort,
    prismaStudioPort: basePort + 1,
    databasePort: basePort + 2,
    databaseName: `pinpoint_${workspaceName}`,
    isWorktree: true,
    workspaceName,
    portOffset,
  };
}

/**
 * Calculate unique ports for a workspace with availability checking
 */
async function calculatePortsWithAvailability(
  workspacePath: string = process.cwd(),
): Promise<PortConfiguration> {
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

  // Generate unique ports for worktree environments using ephemeral range
  const hash = hashWorkspacePath(workspacePath);
  const portOffset = hash % EPHEMERAL_PORT_RANGE;
  const basePort = EPHEMERAL_PORT_START + portOffset;

  // Extract workspace identifier from path for database naming
  const workspaceName = path
    .basename(workspacePath)
    .replace(/^PinPoint-/i, "")
    .replace(/^pinpoint-/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();

  try {
    // Find available ports starting from the hash-generated base port
    const nextPort = await findAvailablePort(basePort);
    const prismaStudioPort = await findAvailablePort(nextPort + 1);
    const databasePort = await findAvailablePort(prismaStudioPort + 1);

    return {
      nextPort,
      prismaStudioPort,
      databasePort,
      databaseName: `pinpoint_${workspaceName}`,
      isWorktree: true,
      workspaceName,
      portOffset,
    };
  } catch (error) {
    // Fallback to deterministic ports if availability checking fails
    console.warn(
      `Port availability checking failed: ${error}. Using deterministic ports.`,
    );
    return {
      nextPort: basePort,
      prismaStudioPort: basePort + 1,
      databasePort: basePort + 2,
      databaseName: `pinpoint_${workspaceName}`,
      isWorktree: true,
      workspaceName,
      portOffset,
    };
  }
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
    const dbUser = process.env["DB_USER"] || "postgres";
    const dbPassword = process.env["DB_PASSWORD"] || "password"; // Default to 'password' for consistency
    const dbHost = process.env["DB_HOST"] || "localhost";

    envVars.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${ports.databasePort}/${ports.databaseName}`;
  }

  return envVars;
}

/**
 * Generate environment variables for the workspace with availability checking
 */
async function generateEnvVarsWithAvailability(
  workspacePath: string = process.cwd(),
): Promise<EnvironmentVariables> {
  const ports = await calculatePortsWithAvailability(workspacePath);

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
    const dbUser = process.env["DB_USER"] || "postgres";
    const dbPassword = process.env["DB_PASSWORD"] || "password"; // Default to 'password' for consistency
    const dbHost = process.env["DB_HOST"] || "localhost";

    envVars.DATABASE_URL = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${ports.databasePort}/${ports.databaseName}`;
  }

  return envVars;
}

/**
 * Generate environment variables for development only (excludes DATABASE_URL)
 * Used when DATABASE_URL comes from external source like Vercel
 */
function generateDevOnlyEnvVars(
  workspacePath: string = process.cwd(),
): EnvironmentVariables {
  const ports = calculatePorts(workspacePath);

  const envVars: EnvironmentVariables = {};

  // Only set port variables if we're in a worktree environment
  if (ports.isWorktree && ports.nextPort && ports.prismaStudioPort) {
    envVars.PORT = ports.nextPort.toString();
    envVars.PRISMA_STUDIO_PORT = ports.prismaStudioPort.toString();
    // Intentionally exclude DATABASE_URL
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

    case "ports-available":
      calculatePortsWithAvailability(workspacePath)
        .then((ports) => {
          console.log(JSON.stringify(ports, null, 2));
        })
        .catch((error) => {
          console.error(`Error calculating ports: ${error.message}`);
          process.exit(1);
        });
      break;

    case "env":
      const envVars = generateEnvVars(workspacePath);
      for (const [key, value] of Object.entries(envVars)) {
        console.log(`${key}=${value}`);
      }
      break;

    case "env-available":
      generateEnvVarsWithAvailability(workspacePath)
        .then((envVars) => {
          for (const [key, value] of Object.entries(envVars)) {
            console.log(`${key}=${value}`);
          }
        })
        .catch((error) => {
          console.error(
            `Error generating environment variables: ${error.message}`,
          );
          process.exit(1);
        });
      break;

    case "env-dev-only":
      const devOnlyEnvVars = generateDevOnlyEnvVars(workspacePath);
      for (const [key, value] of Object.entries(devOnlyEnvVars)) {
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

    case "check-available":
      calculatePortsWithAvailability(workspacePath)
        .then((ports) => {
          console.log(`Workspace: ${workspacePath}`);
          console.log(`Is worktree: ${ports.isWorktree}`);
          if (ports.isWorktree) {
            console.log(`Next.js port: ${ports.nextPort} (available)`);
            console.log(
              `Prisma Studio port: ${ports.prismaStudioPort} (available)`,
            );
            console.log(
              `Database: ${ports.databaseName} on port ${ports.databasePort} (available)`,
            );
          } else {
            console.log(
              "Using default ports (Next.js: 3000, Prisma Studio: 5555, PostgreSQL: 5432)",
            );
          }
        })
        .catch((error) => {
          console.error(`Error checking port availability: ${error.message}`);
          process.exit(1);
        });
      break;

    default:
      console.log("Usage:");
      console.log(
        "  node port-utils.js ports [workspace-path]           - Get port configuration",
      );
      console.log(
        "  node port-utils.js ports-available [workspace-path] - Get available port configuration",
      );
      console.log(
        "  node port-utils.js env [workspace-path]             - Get environment variables",
      );
      console.log(
        "  node port-utils.js env-available [workspace-path]   - Get environment variables with availability checking",
      );
      console.log(
        "  node port-utils.js env-dev-only [workspace-path]    - Get dev environment variables (excludes DATABASE_URL)",
      );
      console.log(
        "  node port-utils.js check [workspace-path]           - Check port assignment",
      );
      console.log(
        "  node port-utils.js check-available [workspace-path] - Check port assignment with availability",
      );
      break;
  }
}

export {
  calculatePorts,
  calculatePortsWithAvailability,
  generateEnvVars,
  generateEnvVarsWithAvailability,
  hashWorkspacePath,
  isPortAvailable,
  findAvailablePort,
};
