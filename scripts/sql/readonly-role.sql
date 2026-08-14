-- A SELECT-only role for investigative queries against production.
--
-- Run ONCE per database, by a human, with the service-role connection string.
-- This is deliberately NOT a drizzle migration: a login role is an operator
-- concern, not app schema. Preview branches and local stacks have nothing worth
-- protecting and would only accumulate a useless role, and putting `CREATE ROLE`
-- into the migration history means every future `db:reset` re-runs it.
--
--   psql "$POSTGRES_URL_ADMIN" -v pw="$(openssl rand -base64 24)" \
--        -f scripts/sql/readonly-role.sql
--
-- Then build the connection string for scripts/query-readonly.mjs:
--   postgres://pinpoint_readonly.<project-ref>:<pw>@<same-host>:6543/postgres
-- The `.<project-ref>` suffix on the USERNAME is not optional: port 6543 is
-- Supavisor, which routes by tenant and reads it from there, so the bare role
-- name fails authentication rather than failing to route. Put it in .env.local
-- as POSTGRES_URL_READONLY. It does NOT belong in the Vercel env registry — the
-- app never reads it, and the registry's membership test is "PinPoint is broken
-- without this".
--
-- Note: the auth grants below are column-scoped, so `SELECT * FROM auth.users`
-- is denied by design. Name the columns you want. That is the cost of the
-- grant being narrow, and it is worth paying — see the comment on those grants.
--
-- Why this exists: agents investigating a bug need to read production, including
-- `auth.users`. Handing them the service-role string means every read carries
-- write authority, and the only thing standing between a typo and a mutation is
-- the agent's own judgement. This role removes the capability instead of asking
-- for restraint.

\if :{?pw}
\else
  \echo 'ERROR: pass a password with  -v pw=...'
  \quit 1
\endif

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pinpoint_readonly') THEN
    CREATE ROLE pinpoint_readonly LOGIN;
  END IF;
END
$$;

-- Set/rotate the password. Kept out of the DO block so the value is never
-- interpolated into a string that could end up in pg_stat_statements.
ALTER ROLE pinpoint_readonly WITH LOGIN PASSWORD :'pw';

-- BYPASSRLS is what makes the role useful: without it, RLS policies written for
-- end users hide most rows, and an investigation returns a confidently wrong
-- "no rows" rather than an error. It grants visibility, never mutation — the
-- role holds no INSERT/UPDATE/DELETE anywhere, and Supabase forbids SUPERUSER.
ALTER ROLE pinpoint_readonly WITH BYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;

-- Every statement this role runs is read-only, belt to the braces of the
-- read-only transaction scripts/query-readonly.mjs opens.
ALTER ROLE pinpoint_readonly SET default_transaction_read_only = on;

-- The app schema in full: it holds no credentials, and an investigation that
-- has to guess which table it may read is an investigation that reaches for the
-- service-role string instead.
GRANT USAGE ON SCHEMA public TO pinpoint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pinpoint_readonly;

-- Tables added by future migrations, so the role does not silently go stale and
-- start returning permission errors mid-investigation.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pinpoint_readonly;

-- `auth` gets named columns on two tables and nothing else. Read-only is not the
-- same as harmless here: combined with BYPASSRLS, a schema-wide SELECT is an
-- account-takeover path that needs no write at all.
--
--   auth.flow_state            provider_access_token, provider_refresh_token —
--                              live Discord OAuth tokens, plaintext
--   auth.custom_oauth_providers client_secret, also plaintext
--   auth.users                 encrypted_password, recovery_token,
--                              confirmation_token, reauthentication_token
--   auth.sessions              refresh_token_hmac_key
--   auth.refresh_tokens        token
--   auth.mfa_factors           secret (TOTP seeds)
--
-- The connection string this file produces is meant to be handed to agents, so
-- the grant has to be the smallest thing that answers "what did the provider
-- send us" — which is `raw_user_meta_data` on auth.users and `identity_data` on
-- auth.identities, the two fields PP-if48 turned on. `ALTER DEFAULT PRIVILEGES`
-- is deliberately absent for auth: a future GoTrue migration adding another
-- secret column must not be granted automatically.
GRANT USAGE ON SCHEMA auth TO pinpoint_readonly;

GRANT SELECT (
  id, aud, role, email, email_confirmed_at, confirmed_at, invited_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at,
  updated_at, phone, phone_confirmed_at, banned_until, deleted_at,
  is_sso_user, is_anonymous
) ON auth.users TO pinpoint_readonly;

GRANT SELECT (
  id, user_id, provider, provider_id, identity_data, email,
  last_sign_in_at, created_at, updated_at
) ON auth.identities TO pinpoint_readonly;

-- Explicitly withhold everything else. These are already absent by default;
-- stating them means a future `GRANT ... TO PUBLIC` somewhere does not silently
-- widen this role.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public, auth FROM pinpoint_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, auth FROM pinpoint_readonly;
REVOKE CREATE ON SCHEMA public, auth FROM pinpoint_readonly;

-- Vault holds the PinballMap operator credentials; a read-only investigation
-- role has no business decrypting them.
REVOKE ALL ON SCHEMA vault FROM pinpoint_readonly;

\echo 'pinpoint_readonly configured. Verify with:'
\echo '  select rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreaterole from pg_roles where rolname = ''pinpoint_readonly'';'
