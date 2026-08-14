-- Does `pinpoint_readonly` actually have the shape readonly-role.sql intends?
--
-- Run as the admin/service role, against any database where the role has been
-- set up. Raises on the first failing batch, so a plain `psql -f` exits non-zero:
--
--   psql "$POSTGRES_URL_ADMIN" -f scripts/sql/verify-readonly-role.sql
--
-- Reads catalogs and writes nothing, so it is safe against production.
--
-- Why this exists rather than "just read the setup script": that script's most
-- important statement used to be one that SILENTLY DID NOTHING.
-- `GRANT USAGE ON SCHEMA auth` emits a WARNING rather than an error when the
-- grantor lacks grant option, so psql exits 0 and the role ships unable to read
-- the one thing it was built for. Only asserting the resulting privileges
-- catches that class of failure. Every check below is a fact about the catalog,
-- never a restatement of a statement that was issued.

DO $verify$
DECLARE
  failures     int := 0;
  checked      int := 0;

  v_canlogin   boolean;
  v_bypassrls  boolean;
  v_super      boolean;
  v_createrole boolean;
  v_createdb   boolean;
  v_config     text[];
  v_public_tbl text;
  v_leaky_cols text;

  -- Records one assertion: bumps the counters and names the failure.
  -- (PL/pgSQL has no local procedures, so this is spelled out at each site.)
BEGIN
  SELECT rolcanlogin, rolbypassrls, rolsuper, rolcreaterole, rolcreatedb, rolconfig
    INTO v_canlogin, v_bypassrls, v_super, v_createrole, v_createdb, v_config
    FROM pg_roles WHERE rolname = 'pinpoint_readonly';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pinpoint_readonly does not exist — run scripts/sql/readonly-role.sql first';
  END IF;

  ----------------------------------------------------------------------------
  -- Role attributes
  ----------------------------------------------------------------------------
  checked := checked + 1;
  IF NOT v_canlogin THEN
    failures := failures + 1;
    RAISE WARNING 'role cannot LOGIN — the connection string would fail';
  END IF;

  -- Without BYPASSRLS an investigation gets a confidently wrong "no rows"
  -- rather than an error, which is worse than being denied outright.
  checked := checked + 1;
  IF NOT v_bypassrls THEN
    failures := failures + 1;
    RAISE WARNING 'role lacks BYPASSRLS — reads will silently return too few rows';
  END IF;

  checked := checked + 1;
  IF v_super OR v_createrole OR v_createdb THEN
    failures := failures + 1;
    RAISE WARNING 'role has an elevated attribute: super=% createrole=% createdb=%',
      v_super, v_createrole, v_createdb;
  END IF;

  -- The load-bearing write defense. A REVOKE can be undone by a later GRANT;
  -- this cannot.
  checked := checked + 1;
  IF v_config IS NULL OR NOT ('default_transaction_read_only=on' = ANY(v_config)) THEN
    failures := failures + 1;
    RAISE WARNING 'default_transaction_read_only is not pinned on (rolconfig=%)', v_config;
  END IF;

  ----------------------------------------------------------------------------
  -- public: readable, never writable
  ----------------------------------------------------------------------------
  checked := checked + 1;
  IF NOT has_schema_privilege('pinpoint_readonly', 'public', 'USAGE') THEN
    failures := failures + 1;
    RAISE WARNING 'no USAGE on schema public';
  END IF;

  -- Sample a real table rather than trusting the grant statement: what matters
  -- is what the role ended up holding.
  SELECT c.relname INTO v_public_tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
   ORDER BY c.relname LIMIT 1;

  IF v_public_tbl IS NULL THEN
    RAISE WARNING 'no tables in public — public grants not verified (unmigrated database?)';
  ELSE
    checked := checked + 1;
    IF NOT has_table_privilege('pinpoint_readonly', 'public.' || quote_ident(v_public_tbl), 'SELECT') THEN
      failures := failures + 1;
      RAISE WARNING 'cannot SELECT public.% — the public grant did not land', v_public_tbl;
    END IF;

    checked := checked + 1;
    IF has_table_privilege('pinpoint_readonly', 'public.' || quote_ident(v_public_tbl), 'INSERT')
       OR has_table_privilege('pinpoint_readonly', 'public.' || quote_ident(v_public_tbl), 'UPDATE')
       OR has_table_privilege('pinpoint_readonly', 'public.' || quote_ident(v_public_tbl), 'DELETE') THEN
      failures := failures + 1;
      RAISE WARNING 'holds a WRITE privilege on public.%', v_public_tbl;
    END IF;
  END IF;

  ----------------------------------------------------------------------------
  -- auth: reachable ONLY through the views
  ----------------------------------------------------------------------------
  -- The check that would have caught the original bug. Direct USAGE on `auth` is
  -- expected to be absent — not because it was revoked, but because Supabase
  -- cannot grant it from the `postgres` role at all.
  checked := checked + 1;
  IF has_schema_privilege('pinpoint_readonly', 'auth', 'USAGE') THEN
    failures := failures + 1;
    RAISE WARNING 'has direct USAGE on schema auth — the view indirection is being bypassed';
  END IF;

  checked := checked + 1;
  IF NOT has_schema_privilege('pinpoint_readonly', 'readonly_auth', 'USAGE') THEN
    failures := failures + 1;
    RAISE WARNING 'no USAGE on readonly_auth — auth data is unreachable, which is the point of the role';
  END IF;

  checked := checked + 1;
  IF NOT has_table_privilege('pinpoint_readonly', 'readonly_auth.users', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'cannot SELECT readonly_auth.users';
  END IF;

  checked := checked + 1;
  IF NOT has_table_privilege('pinpoint_readonly', 'readonly_auth.identities', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'cannot SELECT readonly_auth.identities';
  END IF;

  -- The views must NOT be security_invoker: the caller has no USAGE on auth, so
  -- an invoker-rights view resolves to permission denied. Asserted because
  -- "harden the view" is a plausible-looking edit that silently breaks it.
  checked := checked + 1;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'readonly_auth'
       AND 'security_invoker=true' = ANY(COALESCE(c.reloptions, '{}'))
  ) THEN
    failures := failures + 1;
    RAISE WARNING 'a readonly_auth view is security_invoker — it will resolve to permission denied';
  END IF;

  ----------------------------------------------------------------------------
  -- No credential ever reaches the views
  ----------------------------------------------------------------------------
  -- Name-based on purpose: it catches a column a future GoTrue release adds that
  -- someone then copies into the view without thinking about what it holds.
  checked := checked + 1;
  SELECT string_agg(table_name || '.' || column_name, ', ')
    INTO v_leaky_cols
    FROM information_schema.columns
   WHERE table_schema = 'readonly_auth'
     AND column_name ~* '(token|secret|password|hmac|nonce|challenge)';

  IF v_leaky_cols IS NOT NULL THEN
    failures := failures + 1;
    RAISE WARNING 'readonly_auth exposes credential-shaped column(s): %', v_leaky_cols;
  END IF;

  -- And the tables those columns live on stay unreachable directly.
  checked := checked + 1;
  IF has_table_privilege('pinpoint_readonly', 'auth.flow_state', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'can SELECT auth.flow_state — that is plaintext OAuth tokens';
  END IF;

  checked := checked + 1;
  IF has_schema_privilege('pinpoint_readonly', 'vault', 'USAGE') THEN
    failures := failures + 1;
    RAISE WARNING 'has USAGE on schema vault';
  END IF;

  ----------------------------------------------------------------------------
  IF failures > 0 THEN
    RAISE EXCEPTION 'pinpoint_readonly: % of % checks failed — see the warnings above',
      failures, checked;
  END IF;

  RAISE NOTICE 'pinpoint_readonly: all % checks pass', checked;
END
$verify$;
