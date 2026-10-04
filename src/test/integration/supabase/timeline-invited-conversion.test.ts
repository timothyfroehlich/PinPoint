/**
 * Integration test: signup conversion of timeline person-references.
 *
 * Invited→real (PP-tv9l) — the headline guarantee of the identity-resolution
 * redesign. When an invited person signs up, the `handle_new_user` trigger
 * must rewrite their `timeline_event_people` references from `invited_id` to
 * the new real `user_id`, exactly as it already rewrites machines/issues — and
 * then delete the `invited_users` row (the ON DELETE RESTRICT FK guarantees the
 * delete cannot succeed while any reference remains).
 *
 * Guest→real (PP-0fg0.3) — when a guest signs up with the email they reported
 * under, the trigger moves their issues to the account and must make the
 * account the `reporter` on those issues' `issue_opened` events, dropping the
 * typed `guestReporterName` so the machine timeline stops showing "(guest)".
 *
 * This MUST run against real Postgres: PGlite does not execute triggers, so
 * this lives in the supabase suite (requires `pnpm supabase:start`). Setup/asserts
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
import { expectLocalSupabaseUrl } from "~/test/helpers/supabase";

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

afterAll(async () => {
  await sql.end();
});

describe("invited→real timeline conversion (PP-tv9l)", () => {
  beforeAll(async () => {
    expectLocalSupabaseUrl(supabaseUrl);

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

describe("guest→real timeline conversion (PP-0fg0.3)", () => {
  const guestStamp = process.hrtime.bigint().toString();
  const guestEmail = `guest-conv-${guestStamp}@example.com`;
  const guestInitials = `GC${guestStamp.slice(-4)}`;
  let guestMachineId: string;
  let guestIssueId: string;
  let openedEventId: string;
  let guestUserId: string | undefined;

  beforeAll(async () => {
    const [machine] = await sql`
      INSERT INTO machines (name, initials)
      VALUES ('Guest Conversion Test', ${guestInitials})
      RETURNING id
    `;
    guestMachineId = machine.id;

    // A public report filed without an account: typed name + email.
    const [issue] = await sql`
      INSERT INTO issues (machine_initials, issue_number, title, reporter_name, reporter_email)
      VALUES (${guestInitials}, 1, 'Guest report', 'Gus Guest', ${guestEmail})
      RETURNING id
    `;
    guestIssueId = issue.id;

    // The issue_opened event createIssue writes for a freeform guest: the
    // typed name and no reporter person-reference.
    const [event] = await sql`
      INSERT INTO timeline_events (machine_id, source_type, tag, event_data)
      VALUES (
        ${guestMachineId}, 'issue', 'issue',
        ${sql.json({
          kind: "issue_opened",
          issueId: guestIssueId,
          issueNumber: 1,
          title: "Guest report",
          guestReporterName: "Gus Guest",
        })}
      )
      RETURNING id
    `;
    openedEventId = event.id;
  });

  afterAll(async () => {
    // Events cascade their people rows; the issue must go before its machine.
    await sql`DELETE FROM timeline_events WHERE id = ${openedEventId}`;
    await sql`DELETE FROM issues WHERE id = ${guestIssueId}`;
    await sql`DELETE FROM machines WHERE id = ${guestMachineId}`;
    if (guestUserId) await admin.auth.admin.deleteUser(guestUserId);
  });

  it("makes the new account the issue_opened reporter and drops the guest name", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: guestEmail,
      email_confirm: true,
      user_metadata: { first_name: "Gus", last_name: "Account" },
    });
    expect(error).toBeNull();
    guestUserId = data.user?.id;
    expect(guestUserId).toBeDefined();

    const reporters = await sql<PersonResolverInput[]>`
      SELECT tep.user_id AS "userId", tep.invited_id AS "invitedId",
             up.name AS "userName", iu.name AS "invitedName"
      FROM timeline_event_people tep
      LEFT JOIN user_profiles up ON up.id = tep.user_id
      LEFT JOIN invited_users iu ON iu.id = tep.invited_id
      WHERE tep.event_id = ${openedEventId} AND tep.role = 'reporter'
    `;
    expect(reporters).toHaveLength(1);
    expect(reporters[0].userId).toBe(guestUserId);
    // The live account name, not the typed guest name.
    expect(resolvePerson(reporters[0])).toEqual({
      displayName: "Gus Account",
      isInvited: false,
    });

    const [event] = await sql`
      SELECT event_data, author_id FROM timeline_events WHERE id = ${openedEventId}
    `;
    expect(event.event_data).toMatchObject({
      kind: "issue_opened",
      issueId: guestIssueId,
    });
    expect(event.event_data).not.toHaveProperty("guestReporterName");
    // Like an account-backed open: the reporter is also the event's author.
    expect(event.author_id).toBe(guestUserId);
  });
});
