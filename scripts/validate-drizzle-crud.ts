// Minimal Drizzle CRUD validation script
// Added to restore missing script referenced by package.json db:validate* commands.
// If DB_VALIDATE_MINIMAL is set, we only perform existence checks.
// Extend later with full schema iteration & CRUD probes.

import postgres from 'postgres';

const MINIMAL = process.env.DB_VALIDATE_MINIMAL === 'true';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

async function main() {
  const start = Date.now();
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    // Basic connectivity
    await sql`SELECT 1`;

    // Table existence sanity checks (core domain tables)
    const tables = ['organizations', 'issues'];
    for (const table of tables) {
      const [row] = await sql<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = ${table}) as exists`;
      if (!row?.exists) {
        console.error(`[db:validate] Required table missing: ${table}`);
        process.exit(1);
      }
    }

    if (!MINIMAL) {
      // Lightweight read probe (no writes to respect pre-beta safety posture)
      const [{ count: orgCount }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text as count FROM organizations`;
      console.log(`[db:validate] organizations count = ${orgCount}`);
    }

    const elapsed = Date.now() - start;
    console.log(`[db:validate] Minimal validation OK in ${elapsed}ms (mode=${MINIMAL ? 'minimal' : 'standard'})`);
  } catch (err) {
    console.error('[db:validate] Validation failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
