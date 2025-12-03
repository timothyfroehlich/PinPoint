 
/* eslint-disable no-undef */
import { execSync } from 'child_process';

// Load .env.local manually if not loaded by node --env-file (for safety/redundancy)
// But we expect it to be loaded by the caller.
const port = process.env.PORT;

if (!port) {
  console.error('❌ PORT environment variable is not set.');
  process.exit(1);
}

console.log(`🔍 Checking for zombie processes on port ${port}...`);

try {
  // -t: terse (only PIDs)
  // -i: select by internet address
  const pids = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();

  if (pids) {
    const pidList = pids.split('\n').join(' ');
    console.log(`🧟 Found zombie processes: ${pidList}`);
    console.log(`🔫 Killing zombies...`);
    execSync(`kill -9 ${pidList}`);
    console.log('✅ Zombies neutralized.');
  } else {
    console.log(`✅ No zombies found on port ${port}.`);
  }
} catch (error) {
  // lsof returns exit code 1 if no processes are found
  if (error.status === 1 && !error.stdout) {
    console.log(`✅ No zombies found on port ${port}.`);
  } else {
    console.error('❌ Error checking/killing zombies:', error.message);
    process.exit(1);
  }
}
