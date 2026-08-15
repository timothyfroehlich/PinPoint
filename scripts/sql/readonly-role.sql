-- A SELECT-only role for investigative queries against production.
--
-- Run ONCE per database, by a human, with the service-role connection string.
-- Re-running it is safe: every step is idempotent, and the auth views are
-- dropped and recreated so an edited column list actually takes effect.
--
-- This is deliberately NOT a drizzle migration: a login role is an operator
-- concern, not app schema. Preview branches and local stacks have nothing worth
-- protecting and would only accumulate a useless role, and putting `CREATE ROLE`
-- into the migration history means every future `db:reset` re-runs it.
--
--   psql "$POSTGRES_URL_ADMIN" -v pw="$(openssl rand -hex 24)" \
--        -f scripts/sql/readonly-role.sql
--
-- Use `rand -hex`, NOT `-base64`: a base64 password can contain `/` or `+`, and
-- a `/` in the password terminates the authority of the connection string below,
-- so `new URL(...)` (what postgres.js parses it with) throws `ERR_INVALID_URL`
-- with no hint that the password is the cause. Hex is URL-safe.
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
-- Why this exists: agents investigating a bug need to read production, including
-- `auth.users`. Handing them the service-role string means every read carries
-- write authority, and the only thing standing between a typo and a mutation is
-- the agent's own judgement. This role removes the capability instead of asking
-- for restraint.
--
-- Reading auth data: query `readonly_auth.users` / `readonly_auth.identities`,
-- NOT `auth.users`. The reason is in the "auth" section below — it is a Supabase
-- platform constraint, not a stylistic choice.
--
-- Verify afterwards with scripts/sql/verify-readonly-role.sql, which asserts the
-- resulting privileges from the catalog. Do not skip it: several statements here
-- fail as WARNINGS rather than errors (see the auth section), and psql exits 0
-- on a warning.

-- Exit non-zero on the first SQL error. Without this, psql's exit status is 0
-- even when a statement errors, so a failed CREATE VIEW or a missing password
-- would leave a broken (or absent) role behind a "success" exit. This is also
-- what makes the missing-password guard below actually stop the run.
\set ON_ERROR_STOP on

\if :{?pw}
\else
  \echo 'ERROR: pass a password with  -v pw=...'
  -- `\quit 1` does NOT exit non-zero — psql ignores the argument and exits 0.
  -- A server error under ON_ERROR_STOP does exit non-zero, so raise one.
  DO $$ BEGIN RAISE EXCEPTION 'missing required -v pw=...'; END $$;
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
--
-- Granting BYPASSRLS requires the granting role to hold it too. On PG<=15 that
-- meant SUPERUSER (which Supabase's `postgres` is not), so this statement would
-- have aborted the whole run under ON_ERROR_STOP; on PG16+ a role with
-- CREATEROLE + BYPASSRLS may grant it, and that is exactly what Supabase gives
-- `postgres`. pinpoint-prod runs PG17, so this succeeds. A pre-16 project would
-- fail here loudly rather than leave a half-built role behind.
ALTER ROLE pinpoint_readonly WITH BYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;

-- Belt to the braces of the read-only transaction query-readonly.mjs opens.
-- NOTE this is the WEAKEST layer, not the load-bearing one: it is a USERSET GUC,
-- so any session can `SET default_transaction_read_only = off`. The durable
-- write defense is the total absence of write grants below — that is what makes
-- a write impossible, and it is what a future edit must not quietly relax.
ALTER ROLE pinpoint_readonly SET default_transaction_read_only = on;

-- The app schema: readable, MINUS the columns that are themselves credentials.
GRANT USAGE ON SCHEMA public TO pinpoint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pinpoint_readonly;

-- Tables added by future migrations, so the role does not silently go stale and
-- start returning permission errors mid-investigation.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pinpoint_readonly;

-- `public` is NOT credential-free, so the blanket grant above is too wide as-is.
-- `collections.view_token` is a base64url share token whose possession grants
-- anonymous read access to an otherwise-private collection — a capability, not a
-- reference. A connection string built to be handed to agents must not expose
-- every member's share token. So: drop the table-level grant on `collections`
-- and re-grant every column of it EXCEPT view_token. Done dynamically, so a
-- column added to `collections` later is still readable; a NEW credential column
-- would be re-exposed, which is why verify-readonly-role.sql scans public for
-- credential-shaped column names the role can read.
--
-- (`bot_token_vault_id` / `outbound_token_vault_id` elsewhere in public are UUID
-- pointers into `vault`, not secrets — the secret is only decryptable with vault
-- access, which this role does not have. They stay readable.)
REVOKE SELECT ON public.collections FROM pinpoint_readonly;
DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'collections'
     AND column_name <> 'view_token';

  IF col_list IS NULL THEN
    RAISE EXCEPTION 'public.collections not found — cannot scope the view_token exclusion';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON public.collections TO pinpoint_readonly',
    col_list
  );
END
$$;

--------------------------------------------------------------------------------
-- auth: reached through views, because it cannot be granted directly
--------------------------------------------------------------------------------
--
-- `GRANT ... ON auth.users TO pinpoint_readonly` does not work on Supabase, and
-- fails in the worst way: schema `auth` is owned by `supabase_admin`, and the
-- `postgres` role you run this as holds USAGE on it *without grant option*
-- (`postgres=U/supabase_admin` in `pg_namespace.nspacl`). So
-- `GRANT USAGE ON SCHEMA auth` emits `WARNING: no privileges were granted` —
-- a warning, not an error (which is why this file sets ON_ERROR_STOP but that
-- alone would not catch it, and why verify-readonly-role.sql exists) — and every
-- column grant beneath it is then unreachable. Supabase does not give `postgres`
-- superuser (docs: "Roles, superuser access and unsupported operations"), and
-- `supabase_admin` is not connectable on a hosted project, so there is no way to
-- grant it. Verified against a local stack: the role got `permission denied for
-- schema auth` on every auth table.
--
-- A view owned by `postgres` is the way through. Views run with their OWNER's
-- privileges unless created `security_invoker=true`, and `postgres` does hold
-- USAGE on `auth` — so the view can read what its caller cannot. Deliberately
-- NOT `security_invoker` here; that is the mechanism, not an oversight.
--
-- This is also a tighter allowlist than column grants were. The columns below
-- are the whole surface: a future GoTrue migration adding another secret column
-- cannot widen it, because the view names its columns and nothing re-derives
-- them. What is being kept out:
--
--   auth.flow_state             provider_access_token, provider_refresh_token —
--                               live Discord OAuth tokens, plaintext
--   auth.custom_oauth_providers client_secret, also plaintext
--   auth.users                  encrypted_password, recovery_token,
--                               confirmation_token, reauthentication_token
--   auth.sessions               refresh_token_hmac_key
--   auth.refresh_tokens         token
--   auth.mfa_factors            secret (TOTP seeds)
--
-- Combined with BYPASSRLS, a schema-wide grant on `auth` would have been an
-- account-takeover path needing no write at all, over a connection string that
-- is meant to be handed to agents.
--
-- The schema is not `public`, so PostgREST does not expose these views over the
-- REST API — `db-schemas` lists `public, graphql_public` and nothing here adds
-- to it. The REVOKEs below are what keep that true if it ever changes.

CREATE SCHEMA IF NOT EXISTS readonly_auth;

-- DROP rather than CREATE OR REPLACE: replacing a view cannot change its column
-- list, so editing the allowlist above would otherwise fail on a re-run.
DROP VIEW IF EXISTS readonly_auth.users;
DROP VIEW IF EXISTS readonly_auth.identities;

CREATE VIEW readonly_auth.users AS
  SELECT
    id, aud, role, email, email_confirmed_at, confirmed_at, invited_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at,
    updated_at, phone, phone_confirmed_at, banned_until, deleted_at,
    is_sso_user, is_anonymous
  FROM auth.users;

CREATE VIEW readonly_auth.identities AS
  SELECT
    id, user_id, provider, provider_id, identity_data, email,
    last_sign_in_at, created_at, updated_at
  FROM auth.identities;

-- Nobody but this role reads these. `anon` and `authenticated` are the two that
-- would matter if the schema were ever added to PostgREST's exposed list.
REVOKE ALL ON SCHEMA readonly_auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA readonly_auth FROM PUBLIC;
REVOKE ALL ON SCHEMA readonly_auth FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA readonly_auth FROM anon, authenticated;

GRANT USAGE ON SCHEMA readonly_auth TO pinpoint_readonly;
GRANT SELECT ON readonly_auth.users, readonly_auth.identities TO pinpoint_readonly;

-- Vault holds the PinballMap operator credentials; a read-only investigation
-- role has no business decrypting them. Guarded on the schema existing: a plain
-- Postgres or a project without supabase_vault has no `vault` schema, and a
-- REVOKE against a missing schema is a hard error that would (under
-- ON_ERROR_STOP) abort the run on its last statement.
DO $$
BEGIN
  IF to_regnamespace('vault') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON SCHEMA vault FROM pinpoint_readonly';
  END IF;
END
$$;

\echo ''
\echo 'pinpoint_readonly configured. Verify with:'
\echo '  psql "$POSTGRES_URL_ADMIN" -f scripts/sql/verify-readonly-role.sql'
