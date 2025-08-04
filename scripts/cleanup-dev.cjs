#!/usr/bin/env node

/**
 * Intelligent cleanup script for development environment
 * Performs smart cleanup before starting development services
 */

const { spawn, exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

// ANSI color codes
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

class DevCleaner {
  constructor() {
    this.results = [];
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async execPromise(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async killProcessesOnPorts(ports) {
    this.log(`🔍 Checking for processes on ports: ${ports.join(", ")}...`);

    for (const port of ports) {
      try {
        // Find process using the port
        const { stdout } = await this.execPromise(
          `lsof -ti :${port} 2>/dev/null || echo ""`,
        );
        const pids = stdout
          .trim()
          .split("\\n")
          .filter((pid) => pid);

        if (pids.length > 0) {
          this.log(
            `${colors.yellow}⚡ Killing ${pids.length} process(es) on port ${port}${colors.reset}`,
          );

          for (const pid of pids) {
            try {
              await this.execPromise(`kill -TERM ${pid}`);
              // Wait a moment for graceful shutdown
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Force kill if still running
              try {
                await this.execPromise(`kill -0 ${pid} 2>/dev/null`);
                await this.execPromise(`kill -KILL ${pid}`);
                this.log(
                  `${colors.red}  ⚡ Force killed process ${pid}${colors.reset}`,
                );
              } catch {
                // Process already terminated
                this.log(
                  `${colors.green}  ✅ Process ${pid} terminated gracefully${colors.reset}`,
                );
              }
            } catch (error) {
              this.log(
                `${colors.red}  ❌ Failed to kill process ${pid}: ${error.message}${colors.reset}`,
              );
            }
          }
        } else {
          this.log(`${colors.green}✅ Port ${port} is free${colors.reset}`);
        }
      } catch (error) {
        this.log(
          `${colors.yellow}⚠️  Could not check port ${port}: ${error.message}${colors.reset}`,
        );
      }
    }
  }

  async clearNextCache() {
    const cacheDirectories = [".next", ".turbo", "node_modules/.cache"];

    this.log("🧹 Clearing Next.js cache directories...");

    for (const dir of cacheDirectories) {
      try {
        const dirPath = path.join(process.cwd(), dir);
        await fs.access(dirPath);
        await fs.rm(dirPath, { recursive: true, force: true });
        this.log(`${colors.green}  ✅ Cleared ${dir}${colors.reset}`);
      } catch (error) {
        if (error.code !== "ENOENT") {
          this.log(
            `${colors.yellow}  ⚠️  Could not clear ${dir}: ${error.message}${colors.reset}`,
          );
        }
      }
    }
  }

  async cleanTempFiles() {
    const tempPaths = ["tmp", ".tmp", "*.log", "coverage"];

    this.log("🗑️  Cleaning temporary files...");

    for (const tempPath of tempPaths) {
      try {
        if (tempPath.includes("*")) {
          // Handle glob patterns
          await this.execPromise(`rm -f ${tempPath} 2>/dev/null || true`);
        } else {
          const fullPath = path.join(process.cwd(), tempPath);
          try {
            await fs.access(fullPath);
            await fs.rm(fullPath, { recursive: true, force: true });
            this.log(`${colors.green}  ✅ Cleaned ${tempPath}${colors.reset}`);
          } catch (error) {
            if (error.code !== "ENOENT") {
              this.log(
                `${colors.yellow}  ⚠️  Could not clean ${tempPath}: ${error.message}${colors.reset}`,
              );
            }
          }
        }
      } catch (error) {
        // Ignore errors for temp file cleanup
      }
    }
  }

  async checkDatabaseConnection() {
    this.log("🗄️  Checking database connection...");

    try {
      await this.execPromise(
        'npx prisma db execute --command "SELECT 1" --schema prisma/schema.prisma',
      );
      this.log(
        `${colors.green}✅ Database connection is healthy${colors.reset}`,
      );
      return true;
    } catch (error) {
      this.log(
        `${colors.red}❌ Database connection failed: ${error.stderr || error.message}${colors.reset}`,
      );
      this.log(
        `${colors.yellow}💡 You may need to run: npm run db:push${colors.reset}`,
      );
      return false;
    }
  }

  async promptDatabaseReset() {
    // For automated cleanup, we'll skip the database reset prompt
    // Users can run npm run db:reset manually if needed
    this.log("💡 To reset database and sessions, run: npm run db:reset");
    return false;
  }

  async runCleanup() {
    this.log(
      `${colors.bold}🧹 Starting Development Environment Cleanup${colors.reset}\\n`,
    );

    try {
      // Step 1: Kill processes on development ports
      await this.killProcessesOnPorts([49200, 5555]);

      // Step 2: Clear caches
      await this.clearNextCache();

      // Step 3: Clean temporary files
      await this.cleanTempFiles();

      // Step 4: Check database
      const dbHealthy = await this.checkDatabaseConnection();

      if (!dbHealthy) {
        await this.promptDatabaseReset();
      }

      this.log(
        `\\n${colors.green}${colors.bold}✅ Development environment cleanup completed!${colors.reset}`,
      );
      this.log(
        `${colors.blue}🚀 Ready to start development services...${colors.reset}\\n`,
      );

      return true;
    } catch (error) {
      this.log(
        `${colors.red}❌ Cleanup failed: ${error.message}${colors.reset}`,
      );
      throw error;
    }
  }
}

// Run cleanup if called directly
if (require.main === module) {
  const cleaner = new DevCleaner();
  cleaner
    .runCleanup()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(
        `${colors.red}❌ Cleanup failed: ${error.message}${colors.reset}`,
      );
      process.exit(1);
    });
}

module.exports = DevCleaner;
