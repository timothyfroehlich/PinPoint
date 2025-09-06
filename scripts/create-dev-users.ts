/**
 * Create Development Users via Supabase Admin API
 *
 * Uses Supabase's admin API to create authenticated users with correct password hashing
 * and upserts memberships directly via a DB connection. Designed to run locally or in CI.
 */

// Load environment variables from .env.local for standalone script execution
import { config } from "dotenv";
config({ path: ".env.local" });

// eslint-disable-next-line no-restricted-imports -- Admin script needs direct Supabase client
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, text } from "drizzle-orm/pg-core";

// Standalone memberships table definition to avoid src/ imports
const memberships = pgTable("memberships", {
  id: text().primaryKey(),
  user_id: text().notNull(),
  organization_id: text().notNull(),
  role_id: text().notNull(),
});

// Type guard
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

interface DevUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
}

const DEV_USERS: DevUser[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    email: "tim.froehlich@example.com",
    name: "Tim Froehlich",
    organizationId: "test-org-pinpoint",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    email: "harry.williams@example.com",
    name: "Harry Williams",
    organizationId: "test-org-pinpoint",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    email: "escher.lefkoff@example.com",
    name: "Escher Lefkoff",
    organizationId: "test-org-pinpoint",
  },
];

const ROLE_IDS = {
  ADMIN: "role-admin-primary-001",
  MEMBER: "role-member-primary-001",
} as const;

const DEV_PASSWORD = "dev-login-123";

async function createDevUsers() {
  // Required environment
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("❌ Missing required environment variables:");
    if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseSecretKey)
      console.error("  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
    process.exit(1);
  }

  // Choose connection string
  const RAW_DIRECT_URL = (process.env.DIRECT_URL ?? "").trim();
  const RAW_DATABASE_URL = (process.env.DATABASE_URL ?? "").trim();
  const CONNECTION_STRING =
    RAW_DIRECT_URL || RAW_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:54322/postgres";

  // Enforce TLS for cloud connections
  const needsSsl = /supabase\.co|pooler\.supabase\.com|amazonaws\.com|rds\.amazonaws\.com/.test(
    CONNECTION_STRING,
  );

  const sql = postgres(CONNECTION_STRING, needsSsl ? { ssl: "require" } : undefined);
  const db = drizzle(sql);

  // Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("🔧 Creating dev users and memberships via Supabase Admin API...");

  for (const user of DEV_USERS) {
    try {
      console.log(`  Creating user: ${user.email}`);
      const { data, error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: DEV_PASSWORD,
        email_confirm: true,
        user_metadata: { name: user.name },
        app_metadata: {
          role: user.email.includes("tim") ? "admin" : "member",
          organizationId: user.organizationId,
        },
      });

      if (error) {
        if (isError(error) && error.message.includes("already registered")) {
          console.log(`  ✓ User ${user.email} already exists`);
        } else {
          throw new Error(
            `Failed to create ${user.email}: ${isError(error) ? error.message : String(error)}`,
          );
        }
      } else if (data?.user) {
        console.log(`  ✅ Successfully created auth user: ${data.user.email}`);
      }

      // Upsert membership
      console.log(`    - Upserting membership for ${user.email}`);
      const roleId = user.email.includes("tim") ? ROLE_IDS.ADMIN : ROLE_IDS.MEMBER;
      await db
        .insert(memberships)
        .values({
          id: `membership-${user.name.toLowerCase().split(" ")[0]}`,
          user_id: user.id,
          organization_id: user.organizationId,
          role_id: roleId,
        })
        .onConflictDoNothing();
      console.log(`    - ✅ Membership upserted for role: ${roleId}`);
    } catch (err) {
      console.error(`  ❌ Error creating ${user.email}:`, err);
    }
  }

  console.log("✅ Dev user and membership creation complete");
  await sql.end();
}

// Run if called directly (ES module compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  createDevUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { createDevUsers };
