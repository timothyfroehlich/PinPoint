import { createScriptClient } from "./lib/pg-client.mjs";

// Use POSTGRES_URL (transaction pooler, :6543, IPv4) — NOT POSTGRES_URL_NON_POOLING
// (the IPv6 direct host, unreachable from CI/preview runners). See AGENTS.md §6.
const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

// Production safety guard. This script DROPs schemas and DELETEs auth users, so
// it must never touch the production project. The preview workflows pass the
// production project ref as PROD_PROJECT_REF (= SUPABASE_PROJECT_ID); a real
// preview branch connects as postgres.<branch-ref>, so the prod ref must NOT
// appear anywhere in the branch connection string.
const prodRef = process.env.PROD_PROJECT_REF;
if (prodRef && databaseUrl.includes(prodRef)) {
  console.error(
    `❌ Refusing to reset: POSTGRES_URL references the production project (${prodRef}).`,
  );
  process.exit(1);
}

async function resetPreviewDB() {
  console.log("🔄 Resetting preview database...");

  const client = createScriptClient(databaseUrl, { max: 1 });

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

    // Clear seeded auth users. seed-users.mjs is skip-if-exists, and the
    // profile-creation trigger only fires on auth-user INSERT — so without this
    // a re-seed would skip the existing users and never recreate the
    // user_profiles rows just dropped above, leaving broken login state. On a
    // preview branch the only auth users are seed/test accounts, so clearing
    // them all restores the same empty state a freshly-created branch has.
    // CASCADE deletes dependent auth rows (identities, sessions, etc.).
    console.log("🗑️  Clearing seeded auth users...");
    await client`DELETE FROM auth.users`;
    console.log("✅ Auth users cleared");

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
