#!/usr/bin/env tsx
/**
 * Ensures test schema is up-to-date with src/server/db/schema.ts
 * Regenerates only if schema.ts is newer than schema.sql
 */
import { statSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..");
const SCHEMA_TS = resolve(ROOT, "src/server/db/schema.ts");
const SCHEMA_SQL = resolve(ROOT, "src/test/setup/schema.sql");

function getModifiedTime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function main() {
  const schemaExists = existsSync(SCHEMA_SQL);
  const schemaTsTime = getModifiedTime(SCHEMA_TS);
  const schemaSqlTime = getModifiedTime(SCHEMA_SQL);

  if (!schemaExists) {
    console.log("⚠️  Test schema missing, generating...");
    execSync("pnpm run test:_generate-schema", { stdio: "inherit" });
    console.log("✅ Test schema generated");
    return;
  }

  if (schemaTsTime > schemaSqlTime) {
    console.log("⚠️  Test schema stale, regenerating...");
    execSync("pnpm run test:_generate-schema", { stdio: "inherit" });
    console.log("✅ Test schema updated");
    return;
  }

  console.log("✓ Test schema up-to-date");
}

main();
