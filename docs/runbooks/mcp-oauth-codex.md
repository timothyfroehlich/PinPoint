# Codex MCP OAuth activation

This runbook activates PinPoint's Supabase OAuth 2.1 path for Codex after the
code and migration land. The MCP endpoint is
`https://pinpoint.austinpinballcollective.org/api/mcp/mcp`; that exact URL is
also its RFC 9728 protected-resource identifier and JWT audience.

The committed Codex project configuration defaults every MCP tool to a prompt
and opts only the six read-only tools into automatic approval. The existing
static bearer remains solely for the already-configured Claude client.

## Safety boundary

Enabling the Supabase custom access-token hook affects every future access
token. Perform the steps in order, keep the canary short, and do not enable the
hook until the DCR-created client is present in `mcp_oauth_clients`.

## One-time canary and pinning

1. Deploy the migration and application code. Confirm an unauthenticated MCP
   request returns `401` with a `resource_metadata` link, and GET that link to
   confirm it returns JSON naming the exact MCP resource and the Supabase Auth
   issuer.
2. In Supabase Authentication > OAuth Server, confirm the authorization path is
   `/oauth/consent`, enable the OAuth server and Dynamic Client Registration,
   and leave the custom access-token hook disabled.
3. Set `MCP_OAUTH_DCR_CANARY=true` in production and redeploy. The canary still
   admits only the UUID in `MCP_ADMIN_USER_ID`, with a live `admin` role and a
   Supabase-verified ES256 token; it temporarily permits the default
   `authenticated` audience and an unregistered client id.
4. Restart Codex so it loads the project `.codex/config.toml`, then run
   `codex mcp login pinpoint`. Complete login as Tim, approve the consent page,
   and call `whoami`. Record its `clientId`; `authMode` must be `oauth`.
5. Insert that exact client id into `public.mcp_oauth_clients`, with name
   `Codex Desktop`, audience
   `https://pinpoint.austinpinballcollective.org/api/mcp/mcp`, and `enabled =
true`. Verify the redirect URI registered by DCR is the exact callback Codex
   used. Keep that client registration and disable Dynamic Client Registration.
6. In Supabase Authentication > Hooks, enable the Postgres custom access-token
   hook `public.mcp_custom_access_token_hook`.
7. Remove `MCP_OAUTH_DCR_CANARY` and redeploy. Add the recorded client id under
   `[mcp_servers.pinpoint.oauth]` as `client_id = "..."` in project config so a
   fresh Codex install does not depend on DCR.
8. Run `codex mcp logout pinpoint`, then `codex mcp login pinpoint` and call
   `whoami` again. Confirm the access token has the exact MCP audience, reads do
   not prompt, and each mutation prompts before execution.

## Refresh and revocation proof

After the final login, let the access token expire (or temporarily use a short
JWT lifetime in a controlled window) and confirm Codex refreshes without a new
browser login. Then revoke the OAuth grant/client session in Supabase and
confirm the next refresh or MCP call fails closed. Restore the normal JWT
lifetime immediately if it was changed.

If any final-mode check fails, disable the OAuth client row (`enabled = false`)
before investigating. This leaves Claude's unrelated static bearer path intact.
