#!/usr/bin/env node
/**
 * Seed Test Users for Local Development
 *
 * Creates test users using Supabase's Admin API.
 * This ensures password hashes are compatible with signInWithPassword().
 *
 * Usage: npm run db:seed-users
 *
 * Password for all test users: "TestPassword123"
 * DO NOT use these in production!
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// Environment variables are loaded by Node.js --env-file flag
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("❌ Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
  console.error("  - DATABASE_URL");
  process.exit(1);
}

// Create Supabase Admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create direct database connection for role updates
const sql = postgres(DATABASE_URL);

const TEST_USERS = [
  { email: "admin@test.com", name: "Admin User", role: "admin" },
  { email: "member@test.com", name: "Member User", role: "member" },
  { email: "guest@test.com", name: "Guest User", role: "guest" },
];

const PASSWORD = "TestPassword123";

async function seedUsers() {
  console.log("🌱 Seeding test users...\n");

  for (const user of TEST_USERS) {
    try {
      // Create user using Supabase Admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: PASSWORD,
        email_confirm: true, // Auto-confirm email for test users
        user_metadata: {
          name: user.name,
        },
      });

      if (error) {
        // Check if user already exists
        if (error.message.includes("already registered") || error.message.includes("already exists")) {
          console.log(`⏭️  ${user.email} already exists, skipping...`);
          continue;
        }
        console.error(`❌ Failed to create ${user.email}:`, error.message);
        console.error(`   Full error:`, JSON.stringify(error, null, 2));
        continue;
      }

      if (!data.user) {
        console.error(`❌ Failed to create ${user.email}: No user returned`);
        continue;
      }

      console.log(`✅ Created ${user.email} (ID: ${data.user.id})`);

      // Update user profile role
      // Note: Profile is auto-created by trigger, we just update the role
      await sql`
        UPDATE user_profiles
        SET role = ${user.role}
        WHERE id = ${data.user.id}
      `;

      console.log(`   └─ Role set to: ${user.role}`);
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }

  console.log("\n✨ Test user seeding complete!");
  console.log("\nTest user credentials:");
  console.log("  admin@test.com (Admin role)");
  console.log("  member@test.com (Member role)");
  console.log("  guest@test.com (Guest role)");
  console.log(`  Password: ${PASSWORD}`);

  await sql.end();
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
