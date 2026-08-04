/**
 * The in-body role guard on the credential RPCs (PP-rnup).
 *
 * `get_pinballmap_credentials()` and `get_pinballmap_api_token()` are
 * SECURITY DEFINER functions that hand back a decrypted Vault secret. The
 * REVOKE/GRANT on them is defense in depth, not the gate: Supabase re-grants
 * EXECUTE on `public.*` functions to `authenticated` at connection time, and
 * PostgREST exposes every public function as `POST /rest/v1/rpc/<name>`. So the
 * only thing standing between a logged-in member and the PinballMap operator
 * token is the `auth.role()` check inside the function body — which is exactly
 * what 0061 shipped without and 0062 adds.
 *
 * This has to run against a real Supabase stack rather than PGlite: PGlite's
 * schema comes from `drizzle-kit export`, which knows nothing about these
 * hand-written function migrations, and there is no `auth.role()` there to
 * check. Mirrors `discord-config-rls.test.ts`, which pins the same property on
 * `get_discord_config()` after 0029 made the identical fix.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for PinballMap credential tests.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const CREDENTIAL_RPCS = [
  "get_pinballmap_credentials",
  "get_pinballmap_api_token",
] as const;

describe("PinballMap credential RPCs — in-body role guard", () => {
  let memberUser: { id: string };
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
    await adminClient.auth.admin.deleteUser(memberUser.id);
  });

  for (const rpc of CREDENTIAL_RPCS) {
    it(`anonymous callers cannot EXECUTE ${rpc}()`, async () => {
      const { data, error } = await anonClient.rpc(rpc);
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/permission|not.*found/i);
      // Belt and braces: a future refactor that downgrades the raise to a
      // silent empty return would still fail here rather than leak.
      expect(data ?? null).toBeNull();
    });

    it(`an authenticated member cannot EXECUTE ${rpc}()`, async () => {
      // The one that matters. Anyone with a PinPoint login holds this JWT.
      const { data, error } = await memberAuthedClient.rpc(rpc);
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/permission|not.*found/i);
      expect(data ?? null).toBeNull();
    });

    it(`service_role can EXECUTE ${rpc}()`, async () => {
      // The guard must not lock out the caller the app actually uses
      // (createAdminClient). Asserts only that it runs — the payload depends on
      // whether the integration has been provisioned in this environment.
      const { error } = await adminClient.rpc(rpc);
      expect(error).toBeNull();
    });
  }
});
