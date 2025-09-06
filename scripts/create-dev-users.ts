/**
 * Create Development Users via Supabase Admin API
 *
 * Uses Supabase's admin API to create authenticated users with correct password hashing
 * and upserts memberships directly via a DB connection. Designed to run locally or in CI.
 */

// Load environment variables from .env.local for standalone script execution
import { config } from "dotenv";
config({ path: ".env.local" });

// Prefer IPv4 to avoid ENETUNREACH on some runners/networks
try {
  // Node.js >= 18
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dns = require("node:dns");
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch {
  // best-effort only
}

// eslint-disable-next-line no-restricted-imports -- Admin script needs direct Supabase client
import { createClient } from "@supabase/supabase-js";
// No direct Postgres connection needed; use Supabase service role for DB ops

// Using Supabase REST for memberships to avoid RLS/network issues in CI

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
  const rawSupabaseUrl = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  ).trim();
  const supabaseSecretKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? ""
  ).trim();

  if (!rawSupabaseUrl || !supabaseSecretKey) {
    console.error("❌ Missing required environment variables:");
    if (!rawSupabaseUrl) console.error("  - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
    if (!supabaseSecretKey)
      console.error("  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
    process.exit(1);
  }

  // Sanitize/build Supabase URL
  function buildSupabaseUrl(input: string): string {
    let u = input.replace(/^"|"$/g, "").replace(/\s+/g, "");
    if (!/^https?:\/\//i.test(u)) {
      // If it's a bare ref or host, try to normalize
      if (/^[a-z0-9-]+\.[a-z0-9.-]+$/i.test(u)) {
        u = `https://${u}`;
      } else if (/^[a-z0-9]{10,}$/i.test(u)) {
        // Looks like a project ref
        u = `https://${u}.supabase.co`;
      }
    }
    // Remove trailing slash for consistency
    u = u.replace(/\/+$/, "");
    // Validate
    try {
      // eslint-disable-next-line no-new
      new URL(u);
      return u;
    } catch {
      console.error("❌ Invalid Supabase URL provided:", input);
      console.error(
        "   Provide a full URL (e.g., https://xyz.supabase.co) in SUPABASE_URL",
      );
      process.exit(1);
    }
  }
  const supabaseUrl = buildSupabaseUrl(rawSupabaseUrl);

  // No direct DB connection – rely on Supabase service role for writes

  // Supabase admin client
  console.log(`🔗 Using Supabase URL: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("🔧 Creating dev users and memberships via Supabase Admin API...");

  // Helper function creation skipped in CI to avoid direct DB connection

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

      // Upsert membership via SECURITY DEFINER helper through Supabase RPC
      console.log(`    - Upserting membership for ${user.email}`);
      const roleId = user.email.includes("tim") ? ROLE_IDS.ADMIN : ROLE_IDS.MEMBER;
      // Upsert membership via service-role REST (RLS bypassed)
      const stableId = `membership-${user.id}-${user.organizationId}`;
      const { error: upsertErr } = await supabase
        .from("memberships")
        .upsert(
          {
            id: stableId,
            user_id: user.id,
            organization_id: user.organizationId,
            role_id: roleId,
          },
          { onConflict: "id" },
        );
      if (upsertErr) {
        throw new Error(`Membership upsert failed: ${upsertErr.message}`);
      }
      console.log(`    - ✅ Membership upserted for role: ${roleId}`);
    } catch (err) {
      console.error(`  ❌ Error creating ${user.email}:`, err);
    }
  }

  console.log("✅ Dev user and membership creation complete");
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
