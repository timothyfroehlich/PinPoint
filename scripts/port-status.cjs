#!/usr/bin/env node

/**
 * Quick port status checker for development ports
 */

const { exec } = require('child_process');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

/**
 * @param {number} port
 */
async function checkPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -ti :${port}`, (error, stdout) => {
      if (error) {
        resolve({ port, status: 'free', pid: null });
      } else {
        const pid = stdout.trim();
        resolve({ port, status: 'occupied', pid });
      }
    });
  });
}

/**
 * @param {string} pid
 */
async function getProcessInfo(pid) {
  return new Promise((resolve) => {
    exec(`ps -p ${pid} -o command=`, (error, stdout) => {
      if (error) {
        resolve('Unknown process');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function main() {
  const ports = [3000, 5555];
  console.log('🔍 Checking development ports...\n');

  for (const port of ports) {
    const result = await checkPort(port);

    if (result.status === 'free') {
      console.log(`Port ${port}: ${colors.green}FREE${colors.reset}`);
    } else {
      const processInfo = await getProcessInfo(result.pid);
      console.log(`Port ${port}: ${colors.red}OCCUPIED${colors.reset} (PID: ${result.pid})`);
      console.log(`  └─ ${processInfo.substring(0, 60)}${processInfo.length > 60 ? '...' : ''}`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
