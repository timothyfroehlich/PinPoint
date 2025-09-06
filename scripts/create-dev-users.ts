/**
 * Create Development Users via Supabase Admin API
 *
 * Uses Supabase's admin API to properly create authenticated users with correct password hashing.
 * This replaces the manual SQL approach which was incompatible with Supabase's auth system.
 * This script is now the single source of truth for creating users AND their memberships.
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

// Standalone type guard to avoid src/ imports
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
};

const DEV_PASSWORD = "dev-login-123";

async function createDevUsers() {
  // Check required environment variables
  // Trim to guard against newline-contaminated values from some env pull tools
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  // Accept either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  ).trim();

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("❌ Missing required environment variables:");
    if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseSecretKey) console.error("  - SUPABASE_SECRET_KEY");
    process.exit(1);
  }

// Create standalone DB client using environment-aware connection
// Prefer DIRECT_URL (direct connection) then DATABASE_URL; fallback to local dev
const RAW_DIRECT_URL = (process.env.DIRECT_URL ?? "").trim();
const RAW_DATABASE_URL = (process.env.DATABASE_URL ?? "").trim();

// Choose the most appropriate connection string
const CONNECTION_STRING =
  RAW_DIRECT_URL || RAW_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:54322/postgres";

// Require SSL for cloud connections (Supabase, etc.)
// The 'postgres' client accepts { ssl: 'require' } to enforce TLS.
const needsSsl = /supabase\.co|pooler\.supabase\.com|amazonaws\.com|rds\.amazonaws\.com/.test(
  CONNECTION_STRING,
);

const sql = postgres(CONNECTION_STRING, needsSsl ? { ssl: "require" } : undefined);
const db = drizzle(sql);

  // Create Supabase admin client
  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey, // Service role key for admin operations
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  console.log(
    "🔧 Creating dev users and memberships via Supabase Admin API...",
  );

  for (const user of DEV_USERS) {
    try {
      console.log(`  Creating user: ${user.email}`);

      const { data, error } = await supabase.auth.admin.createUser({
        id: user.id, // Use our custom UUID
        email: user.email,
        password: DEV_PASSWORD,
        email_confirm: true, // Skip email confirmation for dev users
        user_metadata: {
          name: user.name,
        },
        app_metadata: {
          role: user.email.includes("tim") ? "admin" : "member",
          organizationId: user.organizationId,
        },
      });

      if (error) {
        // Check if user already exists
        if (
          isError(error) &&
          error.message.includes("User already registered")
        ) {
          console.log(`  ✓ User ${user.email} already exists`);
        } else {
          console.error(
            `  ❌ Failed to create ${user.email}:`,
            isError(error) ? error.message : String(error),
          );
        }
      } else {
        console.log(`  ✅ Successfully created auth user: ${user.email}`);
      }

      // ALWAYS attempt to create membership, in case it's missing
      console.log(`    - Upserting membership for ${user.email}`);
      const roleId = user.email.includes("tim")
        ? ROLE_IDS.ADMIN
        : ROLE_IDS.MEMBER;

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
  
  // Clean up database connection
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
