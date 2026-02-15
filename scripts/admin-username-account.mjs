#!/usr/bin/env node
/**
 * Admin Username Account Management
 *
 * Creates and manages username-only accounts that use @pinpoint.internal
 * email addresses. These accounts let users log in with a username instead
 * of a real email.
 *
 * Usage:
 *   Create:  ./scripts/admin-username-account.mjs --username jdoe --first "John" --last "Doe" --role member
 *   Reset:   ./scripts/admin-username-account.mjs --reset-password --username jdoe
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 * Load env: node --env-file=.env.local scripts/admin-username-account.mjs ...
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { parseArgs } from "util";

const INTERNAL_DOMAIN = "pinpoint.internal";

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function usernameToEmail(username) {
  return `${username}@${INTERNAL_DOMAIN}`;
}

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    username: { type: "string" },
    first: { type: "string" },
    last: { type: "string" },
    role: { type: "string", default: "member" },
    "reset-password": { type: "boolean", default: false },
  },
});

if (!values.username) {
  console.error("Error: --username is required");
  console.error("\nUsage:");
  console.error(
    '  Create: node --env-file=.env.local scripts/admin-username-account.mjs --username jdoe --first "John" --last "Doe" --role member'
  );
  console.error(
    "  Reset:  node --env-file=.env.local scripts/admin-username-account.mjs --reset-password --username jdoe"
  );
  process.exit(1);
}

// Validate username format
if (!/^[a-zA-Z0-9_]+$/.test(values.username)) {
  console.error(
    "Error: Username must contain only letters, numbers, and underscores"
  );
  process.exit(1);
}

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Error: Missing environment variables.");
  console.error(
    "  Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  console.error(
    "  Tip: node --env-file=.env.local scripts/admin-username-account.mjs ..."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = usernameToEmail(values.username);

if (values["reset-password"]) {
  // ── Reset Password Mode ──
  // Look up user by email
  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const user = userList.users.find((u) => u.email === email);
  if (!user) {
    console.error(`Error: No account found for username "${values.username}"`);
    process.exit(1);
  }

  const newPassword = generatePassword();
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error("Error resetting password:", updateError.message);
    process.exit(1);
  }

  console.log("\nPassword reset successfully!");
  console.log(`  Username: ${values.username}`);
  console.log(`  New Password: ${newPassword}`);
  console.log("\nGive this password to the user.");
} else {
  // ── Create Mode ──
  if (!values.first || !values.last) {
    console.error(
      "Error: --first and --last are required for account creation"
    );
    process.exit(1);
  }

  const validRoles = ["guest", "member", "admin"];
  if (!validRoles.includes(values.role)) {
    console.error(`Error: --role must be one of: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  const password = generatePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: values.first,
      last_name: values.last,
    },
  });

  if (error) {
    console.error("Error creating account:", error.message);
    process.exit(1);
  }

  console.log("\nAccount created successfully!");
  console.log(`  User ID:  ${data.user.id}`);
  console.log(`  Username: ${values.username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Name:     ${values.first} ${values.last}`);
  console.log(`  Role:     ${values.role}`);
  console.log("\nGive the username and password to the user.");
  console.log('They log in by typing their username in the "Email" field.');

  // Note: The DB trigger auto-creates user_profiles, but the role defaults to "guest".
  // If the desired role is different, we need to update it.
  if (values.role !== "guest") {
    console.log(
      `\nNote: The DB trigger sets role to "guest" by default. Update the role via the Admin > Users panel.`
    );
  }
}
