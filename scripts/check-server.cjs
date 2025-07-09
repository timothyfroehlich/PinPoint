#!/usr/bin/env node

import { exec } from "child_process";

/**
 * Check for existing Next.js development server processes
 * and offer to kill them before starting a new one
 */
function checkForExistingServers() {
  return new Promise((resolve) => {
    exec('ps aux | grep "next.*dev" | grep -v grep', (error, stdout) => {
      if (error || !stdout.trim()) {
        console.log("✅ No existing Next.js dev servers found");
        resolve(true);
        return;
      }

      const processes = stdout.trim().split("\n");
      console.log("⚠️  Found existing Next.js dev server(s):");

      processes.forEach((process, index) => {
        const parts = process.trim().split(/\s+/);
        const pid = parts[1];
        const command = parts.slice(10).join(" ");
        console.log(`   ${index + 1}. PID ${pid}: ${command}`);
      });

      console.log("\n🚨 Multiple dev servers can cause conflicts.");
      console.log('💡 Kill existing servers with: pkill -f "next.*dev"');
      console.log("🚀 Or continue anyway (not recommended)");

      resolve(false);
    });
  });
}

async function main() {
  const canStart = await checkForExistingServers();

  if (!canStart) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkForExistingServers };
