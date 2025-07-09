#!/usr/bin/env node

/**
 * Pre-restart script - runs before nodemon restarts the server
 * Handles graceful shutdown preparation and cleanup
 */

const { exec } = require('child_process');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
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

async function clearNextCache() {
  console.log(`${colors.blue}🧹 Clearing Next.js cache...${colors.reset}`);
  try {
    await execPromise('rm -rf .next/cache 2>/dev/null || true');
    console.log(`${colors.green}✅ Cache cleared${colors.reset}`);
  } catch {
    // Ignore errors - cache might not exist
  }
}

async function checkDatabaseConnection() {
  console.log(`${colors.blue}🗄️  Checking database connection...${colors.reset}`);
  try {
    await execPromise('npx prisma db execute --command "SELECT 1" --schema prisma/schema.prisma');
    console.log(`${colors.green}✅ Database is healthy${colors.reset}`);
  } catch {
    console.log(`${colors.yellow}⚠️  Database connection issue (will retry)${colors.reset}`);
  }
}

async function main() {
  console.log(`${colors.blue}🔄 Preparing for server restart...${colors.reset}`);

  await Promise.all([
    clearNextCache(),
    checkDatabaseConnection()
  ]);

  console.log(`${colors.green}✅ Ready for restart${colors.reset}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
