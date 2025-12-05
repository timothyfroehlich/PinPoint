import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const sql = postgres(connectionString);

async function resetDb() {
  console.log("🗑️  Dropping tables...");
  
  // Drop tables in correct order to avoid FK constraint violations
  await sql`DROP TABLE IF EXISTS issue_comments CASCADE`;
  await sql`DROP TABLE IF EXISTS issue_watchers CASCADE`;
  await sql`DROP TABLE IF EXISTS notifications CASCADE`;
  await sql`DROP TABLE IF EXISTS notification_preferences CASCADE`;
  await sql`DROP TABLE IF EXISTS issues CASCADE`;
  await sql`DROP TABLE IF EXISTS machines CASCADE`;
  await sql`DROP TABLE IF EXISTS user_profiles CASCADE`;
  
  console.log("✅ Tables dropped.");
  
  await sql.end();
}

resetDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
