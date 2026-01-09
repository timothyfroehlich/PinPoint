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
import machinesData from "../src/test/data/machines.json" with { type: "json" };
import usersData from "../src/test/data/users.json" with { type: "json" };

// Environment variables are loaded by Node.js --env-file flag
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("❌ Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
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

const TEST_USERS = Object.values(usersData);

async function seedUsersAndData() {
  console.log("🌱 Seeding test users and data...\n");

  const userIds = {};

  // 1. Create Users
  for (const user of TEST_USERS) {
    try {
      // Create user using Supabase Admin API
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Auto-confirm email for test users
        user_metadata: {
          name: user.name,
          first_name: user.firstName,
          last_name: user.lastName,
        },
      });

      let userId;

      if (error) {
        // Check if user already exists
        if (
          error.message.includes("already registered") ||
          error.message.includes("already been registered") ||
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
      // Ensure user profile exists and has correct role (Upsert)
      // This handles cases where auth.users exists but public.user_profiles was wiped
      await sql`
        INSERT INTO user_profiles (id, email, first_name, last_name, role)
        VALUES (${userId}, ${user.email}, ${user.firstName}, ${user.lastName}, ${user.role})
        ON CONFLICT (id) DO UPDATE SET
          email = ${user.email},
          role = ${user.role},
          first_name = ${user.firstName},
          last_name = ${user.lastName},
          updated_at = NOW()
      `;
      console.log(`   └─ Role set to: ${user.role}`);

      // Ensure notification preferences exist
      await sql`
        INSERT INTO notification_preferences (user_id)
        VALUES (${userId})
        ON CONFLICT (user_id) DO NOTHING
      `;
      console.log(`   └─ Notification preferences ensured`);
    } catch (err) {
      console.error(`❌ Error processing ${user.email}:`, err);
    }
  }

  // 2. Seed Machines (Owned by Admin)
  if (userIds.admin) {
    console.log("\n🎰 Seeding machines...");

    const machines = Object.values(machinesData);

    for (const machine of machines) {
      await sql`
        INSERT INTO machines (id, name, initials, owner_id, created_at, updated_at)
        VALUES (${machine.id}, ${machine.name}, ${machine.initials}, ${userIds.admin}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          owner_id = ${userIds.admin},
          initials = ${machine.initials}
      `;
    }
    console.log("✅ Machines seeded with Admin owner.");

    // 3. Seed Issues
    console.log("\n🔧 Seeding issues...");

    // Attack from Mars: 1 issue
    await sql`
      INSERT INTO issues (id, machine_initials, issue_number, title, description, status, severity, priority, consistency, created_at, updated_at)
      VALUES (
        '10000000-0000-4000-8000-000000000001',
        'AFM',
        1,
        'Right flipper feels weak',
        'The right flipper doesn\''t have full strength. Can still play but makes ramp shots difficult.',
        'confirmed',
        'minor',
        'medium',
        'constant',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // Update AFM next issue number
    await sql`UPDATE machines SET next_issue_number = 2 WHERE initials = 'AFM'`;

    // The Addams Family: Multiple issues
    await sql`
      INSERT INTO issues (id, machine_initials, issue_number, title, description, status, severity, priority, consistency, created_at, updated_at)
      VALUES
      (
        '10000000-0000-4000-8000-000000000002',
        'TAF',
        1,
        'Ball stuck in Thing\''s box',
        'Extended sample issue with many timeline updates.',
        'in_progress',
        'unplayable',
        'high',
        'constant',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
      ),
      (
        '10000000-0000-4000-8000-000000000003',
        'TAF',
        2,
        'Bookcase not registering hits',
        'The bookcase target doesn\''t registering when hit.',
        'need_parts',
        'major',
        'high',
        'frequent',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 day'
      ),
      (
        '10000000-0000-4000-8000-000000000004',
        'TAF',
        3,
        'Dim GI lighting on left side',
        'General illumination bulbs on left side are dim.',
        'new',
        'cosmetic',
        'low',
        'constant',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
      ),
      (
        '10000000-0000-4000-8000-000000000005',
        'TAF',
        4,
        'Bear Kick opto not working',
        'Bear Kick feature not detecting ball.',
        'wait_owner',
        'major',
        'medium',
        'intermittent',
        NOW() - INTERVAL '1 week',
        NOW() - INTERVAL '1 week'
      ),
      (
        '10000000-0000-4000-8000-000000000006',
        'TAF',
        5,
        'Magnet throwing ball to Drain',
        'The Power magnet seems too strong or mistimed.',
        'wont_fix',
        'minor',
        'low',
        'frequent',
        NOW() - INTERVAL '2 weeks',
        NOW() - INTERVAL '2 weeks'
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // Update TAF next issue number
    await sql`UPDATE machines SET next_issue_number = 6 WHERE initials = 'TAF'`;

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
          content: "Status changed from in_progress to fixed",
          isSystem: true,
          daysAgo: 2,
        },
        {
          author: userIds.member,
          content: "Severity changed from unplayable to minor",
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

  // 5. Seed Notifications for admin
  if (userIds.admin) {
    console.log("\n🔔 Seeding notifications...");

    try {
      await sql`
        INSERT INTO notifications (user_id, type, resource_id, resource_type, created_at)
        VALUES
          (
            ${userIds.admin},
            'issue_assigned',
            '10000000-0000-4000-8000-000000000002',
            'issue',
            NOW() - INTERVAL '2 hours'
          ),
          (
            ${userIds.admin},
            'new_comment',
            '10000000-0000-4000-8000-000000000002',
            'issue',
            NOW() - INTERVAL '1 day'
          ),
          (
            ${userIds.admin},
            'issue_status_changed',
            '10000000-0000-4000-8000-000000000003',
            'issue',
            NOW() - INTERVAL '3 hours'
          )
        ON CONFLICT DO NOTHING
      `;
      console.log("✅ Notifications seeded for admin.");
    } catch (err) {
      console.error("❌ Error seeding notifications:", err);
    }
  }

  console.log("\n✨ Seeding complete!");
  console.log("\nTest user credentials:");
  console.log("  admin@test.com (Admin role)");
  console.log("  member@test.com (Member role)");
  console.log("  guest@test.com (Guest role)");
  console.log(`  Password: ${usersData.admin.password}`);

  await sql.end();
  process.exit(0);
}

seedUsersAndData().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
