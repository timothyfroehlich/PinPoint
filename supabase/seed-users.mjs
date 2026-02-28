#!/usr/bin/env node
/* eslint-disable no-undef */
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
const POSTGRES_URL = process.env.POSTGRES_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !POSTGRES_URL) {
  console.error("❌ Missing required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
  console.error("  - POSTGRES_URL");
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
const sql = postgres(POSTGRES_URL);

const TEST_USERS = Object.entries(usersData);

async function seedUsersAndData() {
  console.log("🌱 Seeding test users and data...\n");

  const userIds = {};

  // 1. Create Users
  for (const [key, user] of TEST_USERS) {
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

      userIds[key] = userId;

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

  // 2. Seed Invited Users (for testing invited reporter display)
  console.log("\n👤 Seeding invited users...");

  const invitedUserId = await sql`
    INSERT INTO invited_users (first_name, last_name, email, role)
    VALUES ('Jane', 'Doe', 'jane.doe@example.com', 'guest')
    ON CONFLICT (email) DO UPDATE SET
      first_name = 'Jane',
      last_name = 'Doe'
    RETURNING id
  `.then((rows) => rows[0]?.id);

  if (invitedUserId) {
    console.log(
      `✅ Invited user seeded: jane.doe@example.com (ID: ${invitedUserId})`
    );
  } else {
    console.warn("⚠️ Could not seed invited user");
  }

  // 3. Seed Machines (Distributed ownership)
  if (userIds.admin) {
    console.log("\n🎰 Seeding machines...");

    const machines = Object.values(machinesData);

    // Machine ownership distribution:
    // Admin: Humpty Dumpty, Black Knight, Medieval Madness, Godzilla
    // Member: Slick Chick, Eight Ball Deluxe, Attack from Mars
    // Guest: Fireball, Spider-Man
    // Invited: The Addams Family
    const ownerMap = {
      "HD": userIds.admin,
      "SC": userIds.member,
      "FB": userIds.guest,
      "BK": userIds.admin,
      "EBD": userIds.member,
      "TAF": null, // Will use invited owner
      "AFM": userIds.member,
      "MM": userIds.admin,
      "SM": userIds.guest,
      "GDZ": userIds.admin,
      "TZ": userIds.admin,
    };

    for (const machine of machines) {
      const ownerId = ownerMap[machine.initials];
      const invitedOwnerId = machine.initials === "TAF" ? invitedUserId : null;

      await sql`
        INSERT INTO machines (id, name, initials, owner_id, invited_owner_id, created_at, updated_at)
        VALUES (${machine.id}, ${machine.name}, ${machine.initials}, ${ownerId}, ${invitedOwnerId}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          owner_id = ${ownerId},
          invited_owner_id = ${invitedOwnerId},
          initials = ${machine.initials}
      `;

      // Add owner to machine_watchers (full subscribe)
      if (ownerId) {
        await sql`
          INSERT INTO machine_watchers (machine_id, user_id, watch_mode)
          VALUES (${machine.id}, ${ownerId}, 'subscribe')
          ON CONFLICT (machine_id, user_id) DO UPDATE SET
            watch_mode = 'subscribe'
        `;
      }
    }
    console.log("✅ Machines seeded with distributed ownership.");

    // 3. Seed Issues (18 issues with comprehensive permutations)
    console.log("\n🔧 Seeding issues...");

    const issueSeed = [
      // HD (Humpty Dumpty) - 1947
      {
        id: "10000000-0000-4000-8000-000000000001",
        initials: "HD",
        num: 1,
        title: "Worn flipper bushings",
        desc: "The flippers have excessive play due to worn bushings. This is expected for a 1947 game but affects gameplay precision.",
        status: "new",
        severity: "minor",
        priority: "low",
        frequency: "constant",
        reportedBy: userIds.admin,
      },
      {
        id: "10000000-0000-4000-8000-000000000002",
        initials: "HD",
        num: 2,
        title: "Scoring reels sticking during gameplay",
        desc: "The scoring reels occasionally stick when incrementing, requiring manual adjustment of the step-up unit contacts.",
        status: "in_progress",
        severity: "major",
        priority: "medium",
        frequency: "intermittent",
        reportedBy: userIds.member,
      },
      // SC (Slick Chick) - 1963
      {
        id: "10000000-0000-4000-8000-000000000003",
        initials: "SC",
        num: 1,
        title: "Woodrail finish deteriorating",
        desc: "The original woodrail finish is cracking and peeling in several spots.",
        status: "wont_fix",
        severity: "cosmetic",
        priority: "low",
        frequency: "constant",
        reporterName: "Vintage Collector",
        reporterEmail: "collector@pinball.com",
      },
      // FB (Fireball) - 1972
      {
        id: "10000000-0000-4000-8000-000000000004",
        initials: "FB",
        num: 1,
        title: "Zipper flippers intermittent (with photo)",
        desc: "The famous zipper flippers sometimes fail to activate when the ball rolls over them.",
        status: "confirmed",
        severity: "major",
        priority: "high",
        frequency: "frequent",
        reportedBy: userIds.guest,
      },
      {
        id: "10000000-0000-4000-8000-000000000005",
        initials: "FB",
        num: 2,
        title: "Backglass art fading",
        desc: "UV damage to backglass.",
        status: "fixed",
        severity: "cosmetic",
        priority: "low",
        frequency: "constant",
        reporterEmail: "anon@player.com",
      },
      // BK (Black Knight) - 1980
      {
        id: "10000000-0000-4000-8000-000000000006",
        initials: "BK",
        num: 1,
        title: "Upper playfield magna-save weak",
        desc: "The magna-save on the upper playfield doesn't have enough magnetic strength to reliably save the ball from the outlanes.",
        status: "need_parts",
        severity: "major",
        priority: "high",
        frequency: "constant",
        reportedBy: userIds.admin,
      },
      {
        id: "10000000-0000-4000-8000-000000000007",
        initials: "BK",
        num: 2,
        title: "Speech board crackles",
        desc: "Famous 'You will never defeat the Black Knight!' speech occasionally crackles or cuts out.",
        status: "wait_owner",
        severity: "minor",
        priority: "medium",
        frequency: "intermittent",
        reporterName: "League Player",
      },
      // EBD (Eight Ball Deluxe) - 1981
      {
        id: "10000000-0000-4000-8000-000000000008",
        initials: "EBD",
        num: 1,
        title: "8-ball target stuck (with photo)",
        desc: "The center 8-ball target is stuck in the up position and won't register hits.",
        status: "in_progress",
        severity: "unplayable",
        priority: "high",
        frequency: "constant",
        reportedBy: userIds.member,
      },
      {
        id: "10000000-0000-4000-8000-000000000009",
        initials: "EBD",
        num: 2,
        title: "Drop target bank misaligned",
        desc: "The 3-bank drop targets don't reset properly, causing balls to get stuck.",
        status: "fixed",
        severity: "major",
        priority: "high",
        frequency: "frequent",
        reportedBy: userIds.admin,
      },
      // TAF (The Addams Family) - 1992
      {
        id: "10000000-0000-4000-8000-000000000010",
        initials: "TAF",
        num: 1,
        title: "Thing flips the bird",
        desc: "Thing's mechanism occasionally gets stuck in the extended position, blocking the ball path.",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "intermittent",
        reporterName: "John Guest",
        reporterEmail: "john@guest.com",
      },
      {
        id: "10000000-0000-4000-8000-000000000011",
        initials: "TAF",
        num: 2,
        title: "Bookcase not registering",
        desc: "The bookcase target doesn't register when hit, preventing mansion room awards.",
        status: "confirmed",
        severity: "major",
        priority: "medium",
        frequency: "frequent",
        invitedUserId: invitedUserId,
      },
      {
        id: "10000000-0000-4000-8000-000000000012",
        initials: "TAF",
        num: 3,
        title: "DMD ghosting",
        desc: "Display shows faint ghost images.",
        status: "wai",
        severity: "cosmetic",
        priority: "low",
        frequency: "constant",
        reporterEmail: "display@bug.com",
      },
      // AFM (Attack from Mars) - 1995
      {
        id: "10000000-0000-4000-8000-000000000013",
        initials: "AFM",
        num: 1,
        title: "Saucer doesn't eject reliably (with photo)",
        desc: "The flying saucer fails to eject the ball about 20% of the time, requiring nudging or intervention.",
        status: "in_progress",
        severity: "major",
        priority: "high",
        frequency: "intermittent",
        reportedBy: userIds.member,
      },
      {
        id: "10000000-0000-4000-8000-000000000014",
        initials: "AFM",
        num: 2,
        title: "Stroke of Luck not awarding",
        desc: "The Stroke of Luck random award feature isn't triggering when it should during multiball.",
        status: "no_repro",
        severity: "minor",
        priority: "low",
        frequency: "intermittent",
        reportedBy: userIds.guest,
      },
      // MM (Medieval Madness) - 1997
      {
        id: "10000000-0000-4000-8000-000000000015",
        initials: "MM",
        num: 1,
        title: "Castle gate motor loud (with photo)",
        desc: "The castle gate motor makes an unusually loud grinding noise when opening and closing. Mechanism works but may indicate wear.",
        status: "confirmed",
        severity: "minor",
        priority: "medium",
        frequency: "constant",
        reportedBy: userIds.admin,
      },
      {
        id: "10000000-0000-4000-8000-000000000016",
        initials: "MM",
        num: 2,
        title: "Troll bomb doesn't register",
        desc: "Hitting the troll with the ball doesn't always register, preventing troll bomb completion.",
        status: "duplicate",
        severity: "major",
        priority: "high",
        frequency: "frequent",
        reporterName: "Tournament Director",
      },
      // SM (Spider-Man) - 2007
      {
        id: "10000000-0000-4000-8000-000000000017",
        initials: "SM",
        num: 1,
        title: "Doc Ock target assembly binding",
        desc: "The Doc Ock tentacle target assembly binds when retracting, causing slow resets and occasional ball traps.",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "intermittent",
        reportedBy: userIds.guest,
      },
      // GDZ (Godzilla) - 2021
      {
        id: "10000000-0000-4000-8000-000000000018",
        initials: "GDZ",
        num: 1,
        title: "Building bash toy sticking",
        desc: "The motorized building bash toy occasionally sticks in the down position after being hit, blocking shots to the upper playfield.",
        status: "new",
        severity: "major",
        priority: "high",
        frequency: "intermittent",
        reportedBy: userIds.admin,
      },
      // Truly anonymous issue - no reporter info at all
      {
        id: "10000000-0000-4000-8000-000000000019",
        initials: "GDZ",
        num: 2,
        title: "Left flipper button intermittent",
        desc: "The left flipper button sometimes doesn't register when pressed quickly. May need switch adjustment.",
        status: "new",
        severity: "minor",
        priority: "medium",
        frequency: "intermittent",
        // No reportedBy, reporterName, reporterEmail, or invitedUserId
      },
    ];

    for (const issue of issueSeed) {
      await sql`
        INSERT INTO issues (
          id, machine_initials, issue_number, title, description,
          status, severity, priority, frequency, reported_by, invited_reported_by,
          reporter_name, reporter_email, created_at, updated_at
        ) VALUES (
          ${issue.id}, ${issue.initials}, ${issue.num}, ${issue.title}, ${issue.desc},
          ${issue.status}, ${issue.severity}, ${issue.priority}, ${issue.frequency},
          ${issue.reportedBy ?? null}, ${issue.invitedUserId ?? null},
          ${issue.reporterName ?? null}, ${issue.reporterEmail ?? null}, NOW(), NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          reported_by = EXCLUDED.reported_by,
          invited_reported_by = EXCLUDED.invited_reported_by,
          reporter_name = EXCLUDED.reporter_name,
          reporter_email = EXCLUDED.reporter_email,
          priority = EXCLUDED.priority,
          frequency = EXCLUDED.frequency,
          updated_at = NOW()
      `;

      // Add "Issue reported by..." system comment to match service logic
      let reporterDesc = issue.reporterName ?? "Anonymous";

      if (issue.reportedBy) {
        // In real app, we fetch the user name. Here we can check the user map.
        // Or just default to "Member" if we don't want to lookup.
        // But to be consistent with new service logic, let's try to be specific if possible.
        // For seed simplicity, "Member" is often used, but let's try a realistic fallback.
        const memberRole = Object.keys(userIds).find(
          (role) => userIds[role] === issue.reportedBy
        );
        reporterDesc = memberRole
          ? `${memberRole.charAt(0).toUpperCase() + memberRole.slice(1)} User`
          : "Member";
      } else if (issue.invitedUserId) {
        // For seeding, we know the invited user is 'Jane Doe'
        reporterDesc = "Invited User";
      }

      await sql`
        INSERT INTO issue_comments (issue_id, author_id, content, is_system, created_at, updated_at)
        VALUES (
          ${issue.id},
          null,
          ${`Issue reported by ${reporterDesc}`},
          true,
          NOW(),
          NOW()
        ) ON CONFLICT DO NOTHING
      `;
    }

    // Update next issue numbers for all machines
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'HD'`;
    await sql`UPDATE machines SET next_issue_number = 2 WHERE initials = 'SC'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'FB'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'BK'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'EBD'`;
    await sql`UPDATE machines SET next_issue_number = 4 WHERE initials = 'TAF'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'AFM'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'MM'`;
    await sql`UPDATE machines SET next_issue_number = 2 WHERE initials = 'SM'`;
    await sql`UPDATE machines SET next_issue_number = 3 WHERE initials = 'GDZ'`;

    console.log("✅ Issues seeded.");

    // 4. Seed Comments (distributed across multiple issues)
    if (userIds.member && userIds.admin) {
      console.log("\n💬 Seeding comments...");

      const commentsByIssue = {
        // HD-02: Issue with progression (long title, in_progress)
        "10000000-0000-4000-8000-000000000002": [
          {
            author: userIds.admin,
            content: "Confirmed. Will need to disassemble the score motor assembly.",
            isSystem: false,
            daysAgo: 3,
          },
          {
            author: userIds.admin,
            content: "Status changed from New to In Progress",
            isSystem: true,
            daysAgo: 2.5,
          },
          {
            author: userIds.member,
            content: "Found the issue - linkage arm needs adjustment. Working on it now.",
            isSystem: false,
            daysAgo: 1,
          },
        ],
        // FB-01: Multiple comments showing active discussion
        "10000000-0000-4000-8000-000000000004": [
          {
            author: userIds.admin,
            content: "This is a known issue with Fireball. The zipper flippers use a complex relay system.",
            isSystem: false,
            daysAgo: 5,
          },
          {
            author: userIds.guest,
            content: "Happens about 1 in 5 balls. Very frustrating during tournament play.",
            isSystem: false,
            daysAgo: 4,
          },
          {
            author: userIds.member,
            content: "I can take a look at the relay board this weekend.",
            isSystem: false,
            daysAgo: 2,
          },
          {
            author: userIds.admin,
            content: "Status changed from New to Confirmed",
            isSystem: true,
            daysAgo: 1,
          },
        ],
        // EBD-01: Active repair with updates
        "10000000-0000-4000-8000-000000000008": [
          {
            author: userIds.member,
            content: "Opened up the playfield. The 8-ball target solenoid is binding.",
            isSystem: false,
            daysAgo: 2,
          },
          {
            author: userIds.member,
            content: "Ordered replacement solenoid. ETA 3-5 days.",
            isSystem: false,
            daysAgo: 1.5,
          },
          {
            author: userIds.admin,
            content: "Status changed from New to In Progress",
            isSystem: true,
            daysAgo: 1,
          },
        ],
        // TAF-01: Simple status update
        "10000000-0000-4000-8000-000000000010": [
          {
            author: userIds.admin,
            content: "I'll check this out tomorrow during maintenance.",
            isSystem: false,
            daysAgo: 0.5,
          },
        ],
        // AFM-01: Detailed troubleshooting
        "10000000-0000-4000-8000-000000000013": [
          {
            author: userIds.member,
            content: "Cleaned the saucer opto sensors. Testing now.",
            isSystem: false,
            daysAgo: 3,
          },
          {
            author: userIds.member,
            content: "Still having issues. Might be the coil itself.",
            isSystem: false,
            daysAgo: 2,
          },
          {
            author: userIds.admin,
            content: "Status changed from New to In Progress",
            isSystem: true,
            daysAgo: 1.5,
          },
          {
            author: userIds.admin,
            content: "Assigned to Member User",
            isSystem: true,
            daysAgo: 1.5,
          },
          {
            author: userIds.member,
            content: "Ordered replacement saucer coil from Marco. Should arrive next week.",
            isSystem: false,
            daysAgo: 1,
          },
        ],
        // MM-01: Quick fix documented
        "10000000-0000-4000-8000-000000000015": [
          {
            author: userIds.admin,
            content: "Added some white lithium grease to the motor gears. Much quieter now.",
            isSystem: false,
            daysAgo: 2,
          },
          {
            author: userIds.admin,
            content: "Will monitor over the next few weeks.",
            isSystem: false,
            daysAgo: 2,
          },
        ],
      };

      for (const [issueId, comments] of Object.entries(commentsByIssue)) {
        for (const comment of comments) {
          await sql`
            INSERT INTO issue_comments (issue_id, author_id, content, is_system, created_at, updated_at)
            VALUES (
              ${issueId},
              ${comment.author},
              ${comment.content},
              ${comment.isSystem},
              NOW() - (${comment.daysAgo} || ' days')::INTERVAL,
              NOW() - (${comment.daysAgo} || ' days')::INTERVAL
            )
          `;
        }
      }
      console.log("✅ Comments seeded.");
    }

    // Seed issue images (MC Escher-style pinball images)
    console.log("\n📷 Seeding issue images...");

    const imageSeeds = [
      {
        issueId: "10000000-0000-4000-8000-000000000004", // FB-01 (Fireball zipper flippers)
        uploadedBy: userIds.guest,
        filename: "impossible-flipper-loop.png",
        sizeBytes: 761755,
      },
      {
        issueId: "10000000-0000-4000-8000-000000000008", // EBD-01 (8-ball target stuck)
        uploadedBy: userIds.member,
        filename: "paradox-ramp-network.png",
        sizeBytes: 792547,
      },
      {
        issueId: "10000000-0000-4000-8000-000000000013", // AFM-01 (Saucer eject issue)
        uploadedBy: userIds.member,
        filename: "bumper-tessellation.png",
        sizeBytes: 1133608,
      },
      {
        issueId: "10000000-0000-4000-8000-000000000015", // MM-01 (Castle gate motor)
        uploadedBy: userIds.admin,
        filename: "recursive-playfield.png",
        sizeBytes: 1010743,
      },
    ];

    for (const img of imageSeeds) {
      // Note: Using public folder URLs for seed data
      // These serve from /public/test-fixtures/images/
      // In production, images are uploaded through the proper Vercel Blob flow
      await sql`
        INSERT INTO issue_images (
          issue_id, uploaded_by, full_image_url, full_blob_pathname,
          file_size_bytes, mime_type, original_filename, created_at, updated_at
        ) VALUES (
          ${img.issueId},
          ${img.uploadedBy},
          ${`/test-fixtures/images/${img.filename}`},
          ${`test-fixtures/images/${img.filename}`},
          ${img.sizeBytes},
          'image/png',
          ${img.filename},
          NOW() - INTERVAL '1 day',
          NOW() - INTERVAL '1 day'
        )
        ON CONFLICT DO NOTHING
      `;
    }
    console.log("✅ Issue images seeded.");
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
            'new_comment',
            '10000000-0000-4000-8000-000000000002',
            'issue',
            NOW() - INTERVAL '1 day'
          ),
          (
            ${userIds.admin},
            'issue_status_changed',
            '10000000-0000-4000-8000-000000000008',
            'issue',
            NOW() - INTERVAL '3 hours'
          ),
          (
            ${userIds.admin},
            'new_comment',
            '10000000-0000-4000-8000-000000000015',
            'issue',
            NOW() - INTERVAL '2 hours'
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
  console.log("  testuser@pinpoint.internal (Username account, Member role)");
  console.log("    └─ Login with username: testuser");
  console.log(`  Password: ${usersData.admin.password}`);

  await sql.end();
  process.exit(0);
}

seedUsersAndData().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
