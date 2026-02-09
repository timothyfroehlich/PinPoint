import postgres from "postgres";

// Use POSTGRES_URL (session pooler with IPv4 support) instead of POSTGRES_URL_NON_POOLING (IPv6)
const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

async function resetPreviewDB() {
  console.log("🔄 Resetting preview database...");

  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Drop all tables in public schema (separate statements for pooler compatibility)
    console.log("🗑️  Dropping all tables in public schema...");
    await client`DROP SCHEMA public CASCADE`;
    await client`CREATE SCHEMA public`;
    await client`GRANT ALL ON SCHEMA public TO postgres`;
    await client`GRANT ALL ON SCHEMA public TO public`;
    console.log("✅ All tables dropped successfully");

    // Drop drizzle schema if it exists
    console.log("🗑️  Dropping drizzle schema...");
    await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    console.log("✅ Drizzle schema dropped");

    console.log("✅ Preview database reset complete");
    console.log("ℹ️  Run migrations with: pnpm run migrate:production");
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetPreviewDB();
