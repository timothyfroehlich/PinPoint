/**
 * The in-body role guard on `get_pinballmap_credentials()` (PP-rnup).
 *
 * It is a SECURITY DEFINER function that hands back a decrypted Vault secret —
 * the PinballMap per-operator write token. The REVOKE/GRANT on it is defense in
 * depth, not the gate: Supabase re-grants EXECUTE on `public.*` functions to
 * `authenticated` at connection time, and PostgREST exposes every public
 * function as `POST /rest/v1/rpc/<name>`. So the only thing standing between a
 * logged-in member and the operator token is the `auth.role()` check inside the
 * function body — which is exactly what 0061 shipped without and 0062 adds.
 *
 * This is now the ONLY credential RPC in the schema. `get_pinballmap_api_token()`
 * (0057) carried the same guard but was dropped in 0059 once `api-token.ts`
 * moved to reading `process.env`, so there is nothing left to parameterize over.
 *
 * Has to run against a real Supabase stack rather than PGlite: PGlite's schema
 * comes from `drizzle-kit export`, which knows nothing about hand-written
 * function migrations, and there is no `auth.role()` there to check. Mirrors
 * `discord-config-rls.test.ts`, which pins the same property on
 * `get_discord_config()` after 0029 made the identical fix.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error("Missing Supabase env vars for PinballMap credential tests.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
// Needed to hand `authenticated` the EXECUTE privilege the guard is supposed to
// survive — supabase-js cannot run DDL.
//
// `prepare: false` because `databaseUrl` falls back to `POSTGRES_URL`, which in
// any pooled environment is the Supavisor transaction pooler on `:6543` — no
// prepared statements there (AGENTS.md "Supabase", PP-d8l8). Without it a pooled run
// fails on the GRANT rather than on an assertion, which reads as a broken guard
// test instead of a misconfigured connection.
const sql = postgres(databaseUrl, { prepare: false });

const RPC = "get_pinballmap_credentials";

describe("get_pinballmap_credentials() — in-body role guard", () => {
  // `undefined` until `beforeAll` gets that far — teardown runs even when it
  // does not, so it cannot assume either of these exists.
  let memberUser: { id: string } | undefined;
  let memberAuthedClient: SupabaseClient;

  beforeAll(async () => {
    const memberEmail = `pbm-creds-member-${Date.now()}@test.com`;
    const { data } = await adminClient.auth.admin.createUser({
      email: memberEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: {
        first_name: "Member",
        last_name: "Test",
        role: "member",
      },
    });
    if (!data.user) throw new Error("member user not created");
    memberUser = { id: data.user.id };

    memberAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await memberAuthedClient.auth.signInWithPassword({
      email: memberEmail,
      password: "TestPassword123",
    });
  });

  afterAll(async () => {
    // Ordered worst-consequence-first, and every step reachable even if the one
    // before it throws. A `beforeAll` failure used to take out the whole hook on
    // `memberUser.id`, leaving `authenticated` holding EXECUTE on a credential
    // RPC for the rest of the run and the pg socket open until vitest's
    // teardown timeout.
    try {
      // Defensive: the grant test restores this itself, but a failure mid-test
      // must not leave the privilege behind.
      await sql`REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM anon, authenticated`;
      if (memberUser) await adminClient.auth.admin.deleteUser(memberUser.id);
    } finally {
      await sql.end();
    }
  });

  // The two below exercise the shipped state, where the REVOKE is intact. They
  // do not distinguish which layer refused — the grant test further down is
  // what isolates the body guard. What they pin is that no anonymous or
  // logged-in caller gets a token out of PostgREST, by any route.
  it("anonymous callers cannot EXECUTE it", async () => {
    const { data, error } = await anonClient.rpc(RPC);
    expect(error).not.toBeNull();
    // Belt and braces: a future refactor that downgrades the raise to a silent
    // empty return would still fail here rather than leak.
    expect(data ?? null).toBeNull();
  });

  it("an authenticated member cannot EXECUTE it", async () => {
    // Anyone with a PinPoint login holds this JWT.
    const { data, error } = await memberAuthedClient.rpc(RPC);
    expect(error).not.toBeNull();
    expect(data ?? null).toBeNull();
  });

  it("still refuses a member who HAS been granted EXECUTE", async () => {
    // THE test for 0062, and the only one that isolates the in-body check from
    // the REVOKE. The other two pass on 0061's unhardened function too, because
    // the REVOKE alone stops them — which is exactly the false comfort that let
    // 0028 and 0061 ship without a guard.
    //
    // The threat is that Supabase re-grants EXECUTE on public.* functions to
    // `authenticated` at connection time, silently undoing the REVOKE. Granting
    // it here reproduces that state directly, so the assertion below can only
    // hold if the auth.role() check inside the body is doing the work.
    await sql`GRANT EXECUTE ON FUNCTION public.get_pinballmap_credentials() TO authenticated`;
    try {
      const { data, error } = await memberAuthedClient.rpc(RPC);
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/permission denied/i);
      expect(data ?? null).toBeNull();
    } finally {
      await sql`REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM authenticated`;
    }
  });

  it("service_role can EXECUTE it", async () => {
    // The guard must not lock out the caller the app actually uses
    // (createAdminClient). This also proves the function is really there, so
    // the two refusals above cannot be passing on a missing function.
    const { error } = await adminClient.rpc(RPC);
    expect(error).toBeNull();
  });
});
