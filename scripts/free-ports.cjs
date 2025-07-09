#!/usr/bin/env node

/**
 * Free specific ports that might be stuck
 * Usage: node scripts/free-ports.js 3000 5555
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
 * @param {number} port
 */
async function freePort(port) {
  console.log(`${colors.blue}🔍 Checking port ${port}...${colors.reset}`);

  try {
    const { stdout } = await execPromise(`lsof -ti :${port} 2>/dev/null || echo ""`);
    const pids = stdout.trim().split('\n').filter(/** @type {function(string): boolean} */ (pid) => Boolean(pid));

    if (pids.length === 0) {
      console.log(`${colors.green}✅ Port ${port} is already free${colors.reset}`);
      return true;
    }

    console.log(`${colors.yellow}⚡ Found ${pids.length} process(es) using port ${port}${colors.reset}`);

    for (const pid of pids) {
      try {
        // Get process info first
        const { stdout: processInfo } = await execPromise(`ps -p ${pid} -o command= 2>/dev/null || echo "Unknown process"`);
        console.log(`${colors.yellow}  📋 Process ${pid}: ${processInfo.trim().substring(0, 50)}...${colors.reset}`);

        // Try graceful shutdown first
        await execPromise(`kill -TERM ${pid}`);
        console.log(`${colors.green}  ✅ Sent TERM signal to process ${pid}${colors.reset}`);

        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if still running
        try {
          await execPromise(`kill -0 ${pid} 2>/dev/null`);
          // Still running, force kill
          await execPromise(`kill -KILL ${pid}`);
          console.log(`${colors.red}  ⚡ Force killed process ${pid}${colors.reset}`);
        } catch {
          console.log(`${colors.green}  ✅ Process ${pid} terminated gracefully${colors.reset}`);
        }
      } catch (/** @type {any} */ error) {
        console.log(`${colors.red}  ❌ Failed to kill process ${pid}: ${error.message}${colors.reset}`);
      }
    }

    // Verify port is now free
    const { stdout: checkStdout } = await execPromise(`lsof -ti :${port} 2>/dev/null || echo ""`);
    const remainingPids = checkStdout.trim().split('\n').filter(/** @type {function(string): boolean} */ (pid) => Boolean(pid));

    if (remainingPids.length === 0) {
      console.log(`${colors.green}✅ Port ${port} is now free${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}❌ Port ${port} still has ${remainingPids.length} process(es)${colors.reset}`);
      return false;
    }

  } catch (/** @type {any} */ error) {
    console.log(`${colors.red}❌ Error checking port ${port}: ${error.message}${colors.reset}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const ports = args.length > 0 ? args.map(Number) : [3000, 5555];

  console.log(`${colors.bold}🔓 Freeing Ports: ${ports.join(', ')}${colors.reset}\n`);

  let allFreed = true;

  for (const port of ports) {
    if (isNaN(port)) {
      console.log(`${colors.red}❌ Invalid port: ${args[ports.indexOf(port)]}${colors.reset}`);
      allFreed = false;
      continue;
    }

    const freed = await freePort(port);
    if (!freed) {
      allFreed = false;
    }

    if (port !== ports[ports.length - 1]) {
      console.log(''); // Add spacing between ports
    }
  }

  console.log(`\n${colors.bold}📊 Summary:${colors.reset}`);

  if (allFreed) {
    console.log(`${colors.green}✅ All requested ports are now free!${colors.reset}`);
    console.log(`${colors.blue}🚀 You can now start your development servers${colors.reset}\n`);
  } else {
    console.log(`${colors.red}❌ Some ports could not be freed${colors.reset}`);
    console.log(`${colors.yellow}💡 You may need to restart your system or check for system services${colors.reset}\n`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
