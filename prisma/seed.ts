import { exec } from "child_process";
import { promisify } from "util";

import { createPrismaClient } from "../src/server/db";
import { isDevelopment, isPreview, isProduction } from "../src/lib/environment";

const execAsync = promisify(exec);
const prisma = createPrismaClient();

// Environment-specific seed execution
async function runEnvironmentSpecificSeed(): Promise<void> {
  let seedScript: string;
  let environment: string;

  if (isProduction()) {
    seedScript = "npx tsx prisma/seed-production.ts";
    environment = "production";
  } else {
    // Use development seed for all non-production environments
    // (development, test, preview) to provide rich test data
    seedScript = "npx tsx prisma/seed-development.ts";
    if (isDevelopment()) {
      environment = "development";
    } else if (isPreview()) {
      environment = "preview";
    } else {
      environment = "test";
    }
    console.log("🧪 Using development seed for rich test data");
  }

  console.log(`🌍 Environment: ${environment}`);
  console.log(`🚀 Running: ${seedScript}`);

  try {
    const { stdout, stderr } = await execAsync(seedScript);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error: unknown) {
    console.error("Seed execution failed:", error);
    throw error;
  }
}

async function main(): Promise<void> {
  console.log("🌱 Environment-aware database seeding...");
  await runEnvironmentSpecificSeed();
  console.log("✅ Environment-specific seeding completed!");
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
