# Claude MCP connector (claude.ai, mobile, Claude Code)

Connects Claude to the production PinPoint MCP server through the `pinpoint` plugin in this repository (`plugins/pinpoint/`). The plugin bundles the connector and the `pinpoint-mcp` skill. Authentication is the Supabase OAuth 2.1 path that [the Codex runbook](mcp-oauth-codex.md) activated; nothing about the server changes.

The server admits an OAuth token only when its `client_id` is an enabled row in `public.mcp_oauth_clients`. The custom access-token hook stamps the MCP audience onto tokens for those clients, so a client that is not in the table gets a token the server rejects. Each Claude surface that registers its own OAuth client needs its own row.

## Connect claude.ai (also covers mobile)

1. In Supabase Authentication > OAuth Server, confirm the OAuth server is on and Dynamic Client Registration (DCR) is enabled. If DCR is off, turn it on for this procedure and note that you did. Leave `MCP_OAUTH_DCR_CANARY` unset in Vercel: without it, the unregistered client fails closed.
2. In claude.ai, open Customize > Plugins > Add > Add marketplace and enter `timothyfroehlich/PinPoint`. Install the **PinPoint** plugin.
3. On the plugin's Connectors tab, connect **pinpoint**. Sign in as Tim and approve the PinPoint consent page.
4. The connection fails with an authorization error, either right after the consent page or on the first tool call. That is expected: the new client is not allowlisted yet. Find its id in either place:
   - Supabase Authentication > OAuth Server > clients: the newest client, with redirect URI `https://claude.ai/api/mcp/auth_callback`.
   - Vercel runtime logs: an `mcp.auth rejected` line with `reason: "oauth_client_or_audience"` and its `clientId`.
5. Insert the row (production write; Tim approves it first):

   ```sql
   insert into public.mcp_oauth_clients (client_id, name, audience, enabled)
   values ('<client id>', 'Claude.ai', 'https://pinpoint.austinpinballcollective.org/api/mcp/mcp', true);
   ```

6. In claude.ai, disconnect and reconnect the connector so the next token carries the MCP audience. Call `whoami`: `authMode` is `oauth` and `clientId` is the id from step 4.
7. If you turned DCR on in step 1, turn it off.
8. In the connector's settings, set the read tools (`whoami`, `list_machines`, `get_machine`, `list_issues`, `get_issue`, `search_pinballmap_catalog`, `list_settings_sets`) to always allow and every other tool to ask before running. This is the client-side gate under the skill's confirmation rule.

## Claude Code

A plugin installed on claude.ai syncs to Claude Code, and Claude Code connects to the bundled server directly with its own OAuth client. Its server shows in `/mcp` as `plugin:pinpoint:pinpoint`.

1. Authenticate it from `/mcp`. Repeat steps 4–6 above for the new client, named `Claude Code`, whose redirect URI is a `localhost` callback.
2. Remove the older static-bearer entry so the tools are not listed twice: `claude mcp remove pinpoint -s user`.
3. Retiring `MCP_BEARER_TOKEN` itself (Vercel env and `verify-token.ts` bearer path) is separate work; it stays valid until then.

## Revoking

Set the client's row to `enabled = false`. The next call from that client fails closed; other clients are unaffected.
