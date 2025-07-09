#!/usr/bin/env node

/**
 * Intelligent cleanup script to kill all development processes
 * Handles Next.js server, Prisma Studio, TypeScript watchers, etc.
 */

const { exec } = require('child_process');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * @param {string} command
 */
async function execPromise(command) {
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

/**
 * @param {number[]} ports
 */
async function killProcessesOnPorts(ports) {
  console.log(`${colors.blue}🔍 Finding processes on ports: ${ports.join(', ')}...${colors.reset}`);

  for (const port of ports) {
    try {
      const { stdout } = await execPromise(`lsof -ti :${port} 2>/dev/null || echo ""`);
              const pids = stdout.trim().split('\n').filter(/** @type {function(string): boolean} */ (pid) => Boolean(pid));

      if (pids.length > 0) {
        console.log(`${colors.yellow}⚡ Killing ${pids.length} process(es) on port ${port}${colors.reset}`);

        for (const pid of pids) {
          try {
            // First try graceful shutdown
            await execPromise(`kill -TERM ${pid}`);
            console.log(`${colors.green}  ✅ Sent TERM signal to process ${pid}${colors.reset}`);

            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if still running, force kill if needed
            try {
              await execPromise(`kill -0 ${pid} 2>/dev/null`);
              await execPromise(`kill -KILL ${pid}`);
              console.log(`${colors.red}  ⚡ Force killed process ${pid}${colors.reset}`);
            } catch {
              console.log(`${colors.green}  ✅ Process ${pid} terminated gracefully${colors.reset}`);
            }
          } catch (/** @type {any} */ error) {
            console.log(`${colors.red}  ❌ Failed to kill process ${pid}: ${error.message}${colors.reset}`);
          }
        }
      } else {
        console.log(`${colors.green}✅ Port ${port} is free${colors.reset}`);
      }
    } catch (/** @type {any} */ error) {
      console.log(`${colors.yellow}⚠️  Could not check port ${port}: ${error.message}${colors.reset}`);
    }
  }
}

async function killNodeProcesses() {
  console.log(`${colors.blue}🔍 Finding Node.js development processes...${colors.reset}`);

  try {
    const { stdout } = await execPromise(`ps aux | grep -E "(next|nodemon|tsc|concurrently)" | grep -v grep || echo ""`);

    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      console.log(`${colors.yellow}⚡ Found ${lines.length} development process(es)${colors.reset}`);

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[1];
        const command = parts.slice(10).join(' ');

        try {
          await execPromise(`kill -TERM ${pid}`);
          console.log(`${colors.green}  ✅ Killed: ${command.substring(0, 50)}...${colors.reset}`);
        } catch (/** @type {any} */ error) {
          console.log(`${colors.red}  ❌ Failed to kill ${pid}: ${error.message}${colors.reset}`);
        }
      }
    } else {
      console.log(`${colors.green}✅ No development processes found${colors.reset}`);
    }
  } catch (/** @type {any} */ error) {
    console.log(`${colors.yellow}⚠️  Could not check for Node processes: ${error.message}${colors.reset}`);
  }
}

async function main() {
  console.log(`${colors.bold}🛑 Killing All Development Processes${colors.reset}\n`);

  try {
    // Kill processes on development ports
    await killProcessesOnPorts([3000, 5555]);

    // Kill any remaining development processes
    await killNodeProcesses();

    console.log(`\n${colors.green}${colors.bold}✅ All development processes killed!${colors.reset}`);
    console.log(`${colors.blue}💡 You can now safely restart with: npm run dev:full${colors.reset}\n`);

  } catch (/** @type {any} */ error) {
    console.error(`${colors.red}❌ Failed to kill processes: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
