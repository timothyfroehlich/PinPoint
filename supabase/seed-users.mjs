#!/usr/bin/env node
/**
 * Seed Test Users and Data for Local Development
 *
 * Creates test users using Supabase's Admin API and seeds initial data.
 * This ensures password hashes are compatible with signInWithPassword()
 * and maintains proper foreign key relationships.
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

// Create direct database connection for role updates and data seeding
const sql = postgres(DATABASE_URL);

const TEST_USERS = [
  { email: "admin@test.com", name: "Admin User", role: "admin" },
  { email: "member@test.com", name: "Member User", role: "member" },
  { email: "guest@test.com", name: "Guest User", role: "guest" },
];

const PASSWORD = "TestPassword123";

async function seedUsersAndData() {
  console.log("🌱 Seeding test users and data...\n");

  const userIds = {};

  // 1. Create Users
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

      let userId;

      if (error) {
        // Check if user already exists
        if (
          error.message.includes("already registered") ||
          error.message.includes("already exists")
        ) {
          console.log(`⏭️  ${user.email} already exists, fetching ID...`);
          // Fetch existing user ID
          const existingUser =
            await sql`SELECT id FROM auth.users WHERE email = ${user.email}`;
          if (existingUser.length > 0) {
            userId = existingUser[0].id;
          } else {
            console.error(
              `❌ Could not find ID for existing user ${user.email}`
            );
            continue;
          }
        } else {
          console.error(`❌ Failed to create ${user.email}:`, error.message);
          continue;
        }
      } else {
        userId = data.user.id;
        console.log(`✅ Created ${user.email} (ID: ${userId})`);
      }

      userIds[user.role] = userId;

      // Update user profile role
      await sql`
        UPDATE user_profiles
        SET role = ${user.role}
        WHERE id = ${userId}
      `;
      console.log(`   └─ Role set to: ${user.role}`);
    } catch (err) {
      console.error(`❌ Error processing ${user.email}:`, err);
    }
  }

  // 2. Seed Machines (Owned by Admin)
  if (userIds.admin) {
    console.log("\n🎰 Seeding machines...");

    const machines = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Medieval Madness" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Attack from Mars" },
      { id: "33333333-3333-4333-8333-333333333333", name: "The Addams Family" },
    ];

    for (const machine of machines) {
      await sql`
        INSERT INTO machines (id, name, owner_id, created_at, updated_at)
        VALUES (${machine.id}, ${machine.name}, ${userIds.admin}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET owner_id = ${userIds.admin}
      `;
    }
    console.log("✅ Machines seeded with Admin owner.");

    // 3. Seed Issues
    console.log("\n🔧 Seeding issues...");

    // Attack from Mars: 1 playable issue
    await sql`
      INSERT INTO issues (id, machine_id, title, description, status, severity, created_at, updated_at)
      VALUES (
        '10000000-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222222',
        'Right flipper feels weak',
        'The right flipper doesn''t have full strength. Can still play but makes ramp shots difficult.',
        'new',
        'playable',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // The Addams Family: Multiple issues
    await sql`
      INSERT INTO issues (id, machine_id, title, description, status, severity, created_at, updated_at)
      VALUES
      (
        '10000000-0000-4000-8000-000000000002',
        '33333333-3333-4333-8333-333333333333',
        'Ball stuck in Thing''s box',
        'Extended sample issue with many timeline updates.',
        'new',
        'unplayable',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      ),
      (
        '10000000-0000-4000-8000-000000000003',
        '33333333-3333-4333-8333-333333333333',
        'Bookcase not registering hits',
        'The bookcase target isn''t registering when hit.',
        'in_progress',
        'playable',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 day'
      ),
      (
        '10000000-0000-4000-8000-000000000004',
        '33333333-3333-4333-8333-333333333333',
        'Dim GI lighting on left side',
        'General illumination bulbs on left side are dim.',
        'new',
        'minor',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
      ),
      (
        '10000000-0000-4000-8000-000000000005',
        '33333333-3333-4333-8333-333333333333',
        'Bear Kick opto not working',
        'Bear Kick feature not detecting ball.',
        'new',
        'playable',
        NOW() - INTERVAL '1 week',
        NOW() - INTERVAL '1 week'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log("✅ Issues seeded.");

    // 4. Seed Comments (using real user IDs)
    if (userIds.member && userIds.admin) {
      console.log("\n💬 Seeding comments...");

      // Clear existing comments for the main issue to avoid duplicates/mess
      await sql`DELETE FROM issue_comments WHERE issue_id = '10000000-0000-4000-8000-000000000002'`;

      const comments = [
        {
          author: userIds.member,
          content: "Initial report logged from the front desk.",
          isSystem: false,
          daysAgo: 9,
        },
        {
          author: userIds.admin,
          content: "Severity changed from playable to unplayable",
          isSystem: true,
          daysAgo: 8,
        },
        {
          author: userIds.admin,
          content: "Ordering a replacement opto board.",
          isSystem: false,
          daysAgo: 7,
        },
        {
          author: userIds.admin,
          content: "Status changed from new to in_progress",
          isSystem: true,
          daysAgo: 6,
        },
        {
          author: userIds.member,
          content: "Installed new opto board. Ball still sticks occasionally.",
          isSystem: false,
          daysAgo: 5,
        },
        {
          author: userIds.admin,
          content: "Assigned to Member User",
          isSystem: true,
          daysAgo: 4,
        },
        {
          author: userIds.member,
          content: "Adjusted coil stop tension. Ball ejects reliably now.",
          isSystem: false,
          daysAgo: 3,
        },
        {
          author: userIds.member,
          content: "Status changed from in_progress to resolved",
          isSystem: true,
          daysAgo: 2,
        },
        {
          author: userIds.member,
          content: "Severity changed from unplayable to playable",
          isSystem: true,
          daysAgo: 1.5,
        },
        {
          author: userIds.admin,
          content: "Monitoring for another 48 hours.",
          isSystem: false,
          daysAgo: 0.75,
        },
      ];

      for (const comment of comments) {
        await sql`
                INSERT INTO issue_comments (issue_id, author_id, content, is_system, created_at, updated_at)
                VALUES (
                    '10000000-0000-4000-8000-000000000002',
                    ${comment.author},
                    ${comment.content},
                    ${comment.isSystem},
                    NOW() - (${comment.daysAgo} || ' days')::INTERVAL,
                    NOW() - (${comment.daysAgo} || ' days')::INTERVAL
                )
            `;
      }
      console.log("✅ Comments seeded.");
    }
  } else {
    console.warn("⚠️ Admin user not found, skipping machine/issue seeding.");
  }

  console.log("\n✨ Seeding complete!");
  console.log("\nTest user credentials:");
  console.log("  admin@test.com (Admin role)");
  console.log("  member@test.com (Member role)");
  console.log("  guest@test.com (Guest role)");
  console.log(`  Password: ${PASSWORD}`);

  await sql.end();
  process.exit(0);
}

seedUsersAndData().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
