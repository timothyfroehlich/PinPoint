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
-- Why this exists: agents investigating a bug need to read production, including
-- `auth.users`. Handing them the service-role string means every read carries
-- write authority, and the only thing standing between a typo and a mutation is
-- the agent's own judgement. This role removes the capability instead of asking
-- for restraint.
--
-- Reading auth data: query `readonly_auth.users` / `readonly_auth.identities`,
-- NOT `auth.users`. The reason is in the "auth" section below — it is a Supabase
-- platform constraint, not a stylistic choice.

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
-- read-only transaction scripts/query-readonly.mjs opens. This is the load-
-- bearing write defense: unlike a REVOKE, it cannot be widened later by someone
-- granting a privilege to PUBLIC.
ALTER ROLE pinpoint_readonly SET default_transaction_read_only = on;

-- The app schema in full: it holds no credentials, and an investigation that
-- has to guess which table it may read is an investigation that reaches for the
-- service-role string instead.
GRANT USAGE ON SCHEMA public TO pinpoint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pinpoint_readonly;

-- Tables added by future migrations, so the role does not silently go stale and
-- start returning permission errors mid-investigation.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pinpoint_readonly;

--------------------------------------------------------------------------------
-- auth: reached through views, because it cannot be granted directly
--------------------------------------------------------------------------------
--
-- `GRANT ... ON auth.users TO pinpoint_readonly` does not work on Supabase, and
-- fails in the worst way: schema `auth` is owned by `supabase_admin`, and the
-- `postgres` role you run this as holds USAGE on it *without grant option*
-- (`postgres=U/supabase_admin` in `pg_namespace.nspacl`). So
-- `GRANT USAGE ON SCHEMA auth` emits `WARNING: no privileges were granted` —
-- a warning, not an error, so a script that only checks exit codes reports
-- success — and every column grant beneath it is then unreachable. Supabase does
-- not give `postgres` superuser (docs: "Roles, superuser access and unsupported
-- operations"), and `supabase_admin` is not connectable on a hosted project, so
-- there is no way to grant it. Verified against a local stack: the role got
-- `permission denied for schema auth` on every auth table.
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
-- role has no business decrypting them. Already absent by default — stated so
-- the intent survives someone reading only this file.
REVOKE ALL ON SCHEMA vault FROM pinpoint_readonly;

\echo ''
\echo 'pinpoint_readonly configured. Verify with:'
\echo '  \\i scripts/sql/verify-readonly-role.sql'
