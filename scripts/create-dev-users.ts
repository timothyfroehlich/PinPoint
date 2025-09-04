/**
 * Create Development Users via Supabase Admin API
 *
 * Uses Supabase's admin API to properly create authenticated users with correct password hashing.
 * This replaces the manual SQL approach which was incompatible with Supabase's auth system.
 */

// Load environment variables from .env.local for standalone script execution
import { config } from "dotenv";
config({ path: ".env.local" });

// eslint-disable-next-line no-restricted-imports -- Admin script needs direct Supabase client
import { createClient } from "@supabase/supabase-js";
import { isError } from "../src/lib/utils/type-guards";

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

const DEV_PASSWORD = "dev-login-123";

async function createDevUsers() {
  // Check required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("❌ Missing required environment variables:");
    if (!supabaseUrl) console.error("  - NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseSecretKey) console.error("  - SUPABASE_SECRET_KEY");
    process.exit(1);
  }

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

  console.log("🔧 Creating dev users via Supabase Admin API...");

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
          organizationId: user.organizationId,
        },
        app_metadata: {
          role: user.email.includes("tim") ? "admin" : "member",
        },
      });

      if (error) {
        // Check if user already exists
        if (isError(error) && error.message.includes("User already registered")) {
          console.log(`  ✓ User ${user.email} already exists`);
        } else {
          console.error(`  ❌ Failed to create ${user.email}:`, isError(error) ? error.message : String(error));
        }
      } else {
        console.log(`  ✅ Successfully created ${user.email}`);
      }
    } catch (err) {
      console.error(`  ❌ Error creating ${user.email}:`, err);
    }
  }

  console.log("✅ Dev user creation complete");
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
