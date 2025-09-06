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
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, text } from "drizzle-orm/pg-core";

// Standalone memberships table definition to avoid src/ imports
const memberships = pgTable("memberships", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  organization_id: text("organization_id").notNull(),
  role_id: text("role_id").notNull(),
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

  // Detect pgBouncer pooler connection (Supabase pooled port/host)
  let isPooler = false;
  try {
    const u = new URL(CONNECTION_STRING);
    const host = u.hostname;
    const port = Number(u.port || 5432);
    if (/pooler\.supabase\.com$/.test(host) || port === 6543) {
      isPooler = true;
    }
    console.log(
      `🧩 Connecting to DB host=${host} port=${port} (pooler=${isPooler ? "yes" : "no"}) SSL=${needsSsl ? "require" : "off"}`,
    );
  } catch {
    // ignore URL parse errors; fall back to defaults
  }

  const pgOptions: postgres.Options<Record<string, postgres.PostgresType>> = {};
  if (needsSsl) pgOptions.ssl = "require" as const;
  if (isPooler) {
    // Required for pgBouncer transaction pooling
    // Ref: https://github.com/porsager/postgres#pgbouncer
    // Drizzle works fine with prepare=false over pgbouncer
    pgOptions.prepare = false as const;
  }

  const sql = postgres(CONNECTION_STRING, pgOptions);
  console.log(
    `🔌 DB connection ready (ssl=${needsSsl ? "require" : "off"}, pooler=${isPooler ? "yes" : "no"})`,
  );
  const db = drizzle(sql);

  // Supabase admin client
  console.log(`🔗 Using Supabase URL: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("🔧 Creating dev users and memberships via Supabase Admin API...");

  // Ensure the admin upsert function exists (idempotent safety)
  const [{ exists: hasFn } = { exists: false } as any] = await sql<
    [{ exists: boolean }]
  >`select exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where p.proname = 'fn_upsert_membership_admin'
          and n.nspname = 'public'
      ) as exists;`;
  if (!hasFn) {
    console.log("🛠️  Admin helper not found; creating public.fn_upsert_membership_admin()...");
    await sql`
      CREATE OR REPLACE FUNCTION public.fn_upsert_membership_admin(
        p_user_id text,
        p_org_id text,
        p_role_id text
      ) RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        v_exists boolean;
        v_id text;
      BEGIN
        IF p_user_id IS NULL OR p_org_id IS NULL OR p_role_id IS NULL THEN
          RAISE EXCEPTION 'fn_upsert_membership_admin: all parameters are required';
        END IF;

        v_id := 'membership-' || left(replace(p_org_id, ' ', ''), 16) || '-' || left(p_user_id, 8);

        SELECT EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.user_id = p_user_id AND m.organization_id = p_org_id
        ) INTO v_exists;

        IF v_exists THEN
          UPDATE memberships
          SET role_id = p_role_id
          WHERE user_id = p_user_id AND organization_id = p_org_id;
        ELSE
          INSERT INTO memberships (id, user_id, organization_id, role_id)
          VALUES (v_id, p_user_id, p_org_id, p_role_id);
        END IF;
      END;
      $$;
    `;
    console.log("   ✅ Helper function created");
  } else {
    console.log("🧩 Admin helper already present");
  }

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
      const { error: rpcError } = await supabase.rpc(
        "fn_upsert_membership_admin",
        { p_user_id: user.id, p_org_id: user.organizationId, p_role_id: roleId },
      );
      if (rpcError) {
        console.warn(
          `    - RPC upsert failed (${rpcError.message}); falling back to direct service-role upsert`,
        );
        // Fallback strategy using service-role table access
        const stableId = `membership-${user.id}-${user.organizationId}`;
        const { error: delErr } = await supabase
          .from("memberships")
          .delete()
          .eq("user_id", user.id)
          .eq("organization_id", user.organizationId);
        if (delErr) {
          throw new Error(`Membership delete failed: ${delErr.message}`);
        }
        const { error: insErr } = await supabase.from("memberships").insert({
          id: stableId,
          user_id: user.id,
          organization_id: user.organizationId,
          role_id: roleId,
        });
        if (insErr) {
          throw new Error(`Membership insert failed: ${insErr.message}`);
        }
      }
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
