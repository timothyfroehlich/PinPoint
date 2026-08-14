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
--   postgres://pinpoint_readonly:<pw>@<same-host>:6543/postgres
-- and put it in .env.local as POSTGRES_URL_READONLY. It does NOT belong in the
-- Vercel env registry — the app never reads it, and the registry's membership
-- test is "PinPoint is broken without this".
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

-- Read-only on the two schemas an investigation actually needs. `auth` is
-- included because provider metadata (raw_user_meta_data) lives there and was
-- the crux of PP-if48 — the app schema alone could not explain the bug.
GRANT USAGE ON SCHEMA public, auth TO pinpoint_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO pinpoint_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA auth   TO pinpoint_readonly;

-- Tables added by future migrations, so the role does not silently go stale and
-- start returning permission errors mid-investigation.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pinpoint_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth   GRANT SELECT ON TABLES TO pinpoint_readonly;

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
