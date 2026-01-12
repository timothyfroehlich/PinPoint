#!/usr/bin/env tsx
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Vercel uses POSTGRES_URL or DATABASE_URL, Supabase uses DIRECT_URL
const connectionString =
  process.env["DATABASE_URL"] ??
  process.env["DIRECT_URL"] ??
  process.env["POSTGRES_URL"];

if (!connectionString) {
  console.error(
    "❌ No database connection string found (checked DATABASE_URL, DIRECT_URL, POSTGRES_URL)"
  );
  process.exit(1);
}

// Connection for migration must not use connection pooling if possible,
// but Supabase transaction poolers (port 6543) don't support prepared statements anyway.
// Ideally use the direct connection (port 5432).
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log("🔄 Running production migrations...");

  try {
    // Look for migrations in the 'drizzle' folder in the root
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
