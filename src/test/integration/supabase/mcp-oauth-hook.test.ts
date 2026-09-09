/** Real-Postgres proof for the MCP OAuth custom access-token hook. */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("Missing POSTGRES_URL for MCP OAuth hook tests.");
}

const sql = postgres(databaseUrl, { prepare: false });
const authAdminUrl = new URL(databaseUrl);
authAdminUrl.username = "supabase_auth_admin";
const authAdminSql = postgres(authAdminUrl.toString(), { prepare: false });
const CLIENT_ID = "mcp-oauth-hook-test-client";
const RESOURCE = "https://pinpoint.test/api/mcp/mcp";

interface HookRow {
  result: {
    claims: Record<string, unknown>;
  };
}

describe("mcp_custom_access_token_hook", () => {
  beforeAll(async () => {
    await sql`
      INSERT INTO public.mcp_oauth_clients (client_id, name, audience)
      VALUES (${CLIENT_ID}, 'Hook test', ${RESOURCE})
    `;
  });

  afterAll(async () => {
    try {
      await sql`
        DELETE FROM public.mcp_oauth_clients WHERE client_id = ${CLIENT_ID}
      `;
    } finally {
      await Promise.all([sql.end(), authAdminSql.end()]);
    }
  });

  it("replaces aud only for an enabled registered OAuth client", async () => {
    const event = {
      user_id: "11111111-1111-4111-8111-111111111111",
      claims: {
        aud: "authenticated",
        sub: "11111111-1111-4111-8111-111111111111",
        client_id: CLIENT_ID,
      },
      authentication_method: "oauth_provider/authorization_code",
    };

    const [registered, unknown] = await authAdminSql.begin(
      async (transaction) => {
        const [registeredRow] = await transaction<HookRow[]>`
        SELECT public.mcp_custom_access_token_hook(${sql.json(event)}::jsonb) AS result
      `;
        const [unknownRow] = await transaction<HookRow[]>`
        SELECT public.mcp_custom_access_token_hook(
          ${sql.json({
            ...event,
            claims: { ...event.claims, client_id: "unknown-client" },
          })}::jsonb
        ) AS result
      `;
        return [registeredRow, unknownRow];
      }
    );
    expect(registered?.result.claims.aud).toBe(RESOURCE);
    expect(unknown?.result.claims.aud).toBe("authenticated");
  });

  it("refuses API roles even if Supabase re-grants function execution", async () => {
    await expect(
      sql.begin(async (transaction) => {
        await transaction`SET LOCAL ROLE authenticated`;
        return transaction`
          SELECT public.mcp_custom_access_token_hook(
            '{"claims":{"aud":"authenticated"}}'::jsonb
          )
        `;
      })
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("denies the client allowlist to authenticated API users", async () => {
    const outcome = await sql
      .begin(async (transaction) => {
        await transaction`SET LOCAL ROLE authenticated`;
        const rows = await transaction`
          SELECT client_id FROM public.mcp_oauth_clients
          WHERE client_id = ${CLIENT_ID}
        `;
        return { kind: "rows", rows } as const;
      })
      .catch((error: unknown) => ({ kind: "error", error }) as const);

    // Supabase images may re-grant SELECT on public tables after migrations.
    // Either the explicit REVOKE remains effective or RLS filters every row;
    // both outcomes keep client registrations inaccessible to API users.
    if (outcome.kind === "error") {
      expect(outcome.error).toMatchObject({ code: "42501" });
    } else {
      expect(outcome.rows).toHaveLength(0);
    }
  });
});
