/**
 * Integration test: invited→real timeline person-reference conversion (PP-tv9l).
 *
 * The headline guarantee of the identity-resolution redesign. When an invited
 * person signs up, the `handle_new_user` trigger must rewrite their
 * `timeline_event_people` references from `invited_id` to the new real
 * `user_id`, exactly as it already rewrites machines/issues — and then delete
 * the `invited_users` row (the ON DELETE RESTRICT FK guarantees the delete
 * cannot succeed while any reference remains).
 *
 * This MUST run against real Postgres: PGlite does not execute triggers, so
 * this lives in the supabase suite (requires `supabase start`). Setup/asserts
 * use a raw `postgres` connection; signup goes through the admin auth API,
 * which inserts into `auth.users` and fires the trigger synchronously.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import {
  resolvePerson,
  type PersonResolverInput,
} from "~/lib/timeline/resolve-person";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  throw new Error("Missing Supabase / Postgres env vars for integration test");
}

const admin = createClient(supabaseUrl, serviceRoleKey);
const sql = postgres(databaseUrl);

// Unique-per-run identifiers so the shared local DB stays clean across runs.
const stamp = process.hrtime.bigint().toString();
const email = `conv-${stamp}@example.com`;
const initials = `CV${stamp.slice(-4)}`;

let machineId: string;
let eventId: string;
let invitedId: string;
let newUserId: string | undefined;

describe("invited→real timeline conversion (PP-tv9l)", () => {
  beforeAll(async () => {
    expect(supabaseUrl).toMatch(/127\.0\.0\.1|localhost/);

    const [invited] = await sql`
      INSERT INTO invited_users (email, first_name, last_name, role)
      VALUES (${email}, 'Conv', 'Test', 'member')
      RETURNING id
    `;
    invitedId = invited.id;

    const [machine] = await sql`
      INSERT INTO machines (name, initials, invited_owner_id)
      VALUES ('Conversion Test', ${initials}, ${invitedId})
      RETURNING id
    `;
    machineId = machine.id;

    const [event] = await sql`
      INSERT INTO timeline_events (machine_id, source_type, tag, event_data)
      VALUES (${machineId}, 'lifecycle', 'lifecycle', ${sql.json({ kind: "owner_set" })})
      RETURNING id
    `;
    eventId = event.id;

    await sql`
      INSERT INTO timeline_event_people (event_id, role, invited_id)
      VALUES (${eventId}, 'to_owner', ${invitedId})
    `;
  });

  afterAll(async () => {
    // Order matters: people (restrict FK) → events → machine → invited (if any
    // survived a failed run) → auth user (cascades the profile).
    await sql`DELETE FROM timeline_event_people WHERE event_id = ${eventId}`;
    await sql`DELETE FROM timeline_events WHERE id = ${eventId}`;
    await sql`DELETE FROM machines WHERE id = ${machineId}`;
    await sql`DELETE FROM invited_users WHERE id = ${invitedId}`;
    if (newUserId) await admin.auth.admin.deleteUser(newUserId);
    await sql.end();
  });

  it("rewrites the person-reference invited→real and drops the invited row on signup", async () => {
    // Pre-state: the reference points at the invited user, resolves "(invited)".
    const [before] = await sql<PersonResolverInput[]>`
      SELECT tep.user_id AS "userId", tep.invited_id AS "invitedId",
             up.name AS "userName", iu.name AS "invitedName"
      FROM timeline_event_people tep
      LEFT JOIN user_profiles up ON up.id = tep.user_id
      LEFT JOIN invited_users iu ON iu.id = tep.invited_id
      WHERE tep.event_id = ${eventId} AND tep.role = 'to_owner'
    `;
    expect(before.invitedId).toBe(invitedId);
    expect(before.userId).toBeNull();
    expect(resolvePerson(before)).toEqual({
      displayName: "Conv Test",
      isInvited: true,
    });

    // Sign the invited person up — inserting into auth.users fires the
    // on_auth_user_created trigger (handle_new_user) synchronously.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: "Conv", last_name: "Test" },
    });
    expect(error).toBeNull();
    newUserId = data.user?.id;
    expect(newUserId).toBeDefined();

    // Post-state: the reference now points at the real user, the invited_users
    // row is gone, and nothing dangles.
    const [after] = await sql<PersonResolverInput[]>`
      SELECT tep.user_id AS "userId", tep.invited_id AS "invitedId",
             up.name AS "userName", iu.name AS "invitedName"
      FROM timeline_event_people tep
      LEFT JOIN user_profiles up ON up.id = tep.user_id
      LEFT JOIN invited_users iu ON iu.id = tep.invited_id
      WHERE tep.event_id = ${eventId} AND tep.role = 'to_owner'
    `;
    expect(after.userId).toBe(newUserId);
    expect(after.invitedId).toBeNull();

    const stillInvited = await sql`
      SELECT 1 FROM invited_users WHERE id = ${invitedId}
    `;
    expect(stillInvited).toHaveLength(0);

    // Resolves live to the real name now, with no "(invited)" marker.
    expect(resolvePerson(after)).toEqual({
      displayName: "Conv Test",
      isInvited: false,
    });
  });
});
