-- Parity check: does `derive_profile_name()` agree with `deriveName()`?
--
-- The SQL trigger and src/lib/auth/derive-name.ts both write first_name /
-- last_name for the same user, under different conditions — the trigger on
-- `auth.users` insert, the TS on profile auto-heal. Nothing in either file makes
-- the other fail when they disagree, and a disagreement is invisible: you get a
-- name that depends on which code path ran first.
--
-- The cases below are the same cases as src/lib/auth/derive-name.test.ts, in the
-- same order. Change one, change both.
--
-- Raises on the first mismatch, so a plain `psql -f` exits non-zero:
--   node scripts/query-readonly.mjs --file scripts/sql/verify-derive-name.sql
--   (or) psql "$POSTGRES_URL" -f scripts/sql/verify-derive-name.sql

DO $verify$
DECLARE
  c            record;
  got          record;
  failures     int := 0;
  checked      int := 0;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      -- label,             metadata,                                            email,                      first,          last,                 derived
      ('explicit',          '{"first_name":"Tim","last_name":"Froehlich"}',       'tim@example.com',          'Tim',          'Froehlich',          false),
      ('explicit-nolast',   '{"first_name":"Prince"}',                            'prince@example.com',       'Prince',       '',                   false),
      ('blank-explicit',    '{"first_name":"   ","last_name":"  "}',              'someone@example.com',      'someone',      '',                   true),
      ('discord-paul',      '{"full_name":"pmuntner","name":"pmuntner#0","custom_claims":{"global_name":"Paul Muntner"}}', 'pmuntner@yahoo.com', 'Paul', 'Muntner', true),
      ('discord-handle',    '{"full_name":"presidentnick","name":"presidentnick#0","custom_claims":{"global_name":"PresidentNick"}}', 'nickpereira.np@gmail.com', 'PresidentNick', '', true),
      ('no-globalname',     '{"full_name":"someuser","custom_claims":{}}',        'someuser@example.com',     'someuser',     '',                   true),
      ('discriminator',     '{"name":"pmuntner#4821"}',                           'p@example.com',            'pmuntner',     '',                   true),
      ('non-object-claims', '{"custom_claims":"not-an-object","full_name":"Jane Roe"}', 'jane@example.com',   'Jane',         'Roe',                true),
      ('compound',          '{"full_name":"Mary Anne van der Berg"}',             'mary@example.com',         'Mary',         'Anne van der Berg',  true),
      ('whitespace',        '{"full_name":"  Ada   Lovelace  "}',                 'ada@example.com',          'Ada',          'Lovelace',           true),
      ('empty-meta',        '{}',                                                 'keyyek123@gmail.com',      'keyyek123',    '',                   true),
      ('degenerate-hash',   '{"name":"#0"}',                                      'fallback@example.com',     'fallback',     '',                   true),
      ('null-metadata',     NULL,                                                 'someone@example.com',      'someone',      '',                   true)
    ) AS t(label, metadata, email, want_first, want_last, want_derived)
  LOOP
    checked := checked + 1;

    SELECT * INTO got
    FROM public.derive_profile_name(c.metadata::jsonb, c.email);

    IF got.first_name IS DISTINCT FROM c.want_first
       OR got.last_name IS DISTINCT FROM c.want_last
       OR got.derived  IS DISTINCT FROM c.want_derived THEN
      failures := failures + 1;
      RAISE WARNING 'derive_profile_name mismatch [%]: got (%, %, %) want (%, %, %)',
        c.label,
        quote_literal(got.first_name), quote_literal(got.last_name), got.derived,
        quote_literal(c.want_first),   quote_literal(c.want_last),   c.want_derived;
    END IF;
  END LOOP;

  -- The property the DB check depends on: derivation can never return a blank
  -- first name, so `user_profiles_first_name_not_blank` cannot fail a signup.
  -- Asserted separately because it must hold for inputs beyond the table above.
  FOR c IN
    SELECT * FROM (VALUES
      ('{}'), ('{"full_name":"   "}'), ('{"name":"#0"}'),
      ('{"custom_claims":{"global_name":""}}'), ('{"first_name":"","last_name":""}'),
      ('{"first_name":"  "}'), (NULL)
    ) AS t(metadata)
  LOOP
    checked := checked + 1;
    SELECT * INTO got FROM public.derive_profile_name(c.metadata::jsonb, 'x@example.com');
    IF btrim(COALESCE(got.first_name, '')) = '' THEN
      failures := failures + 1;
      RAISE WARNING 'derive_profile_name returned a blank first name for %', c.metadata;
    END IF;
  END LOOP;

  IF failures > 0 THEN
    RAISE EXCEPTION 'derive_profile_name: % of % checks failed — SQL and src/lib/auth/derive-name.ts have diverged',
      failures, checked;
  END IF;

  RAISE NOTICE 'derive_profile_name: all % checks match src/lib/auth/derive-name.ts', checked;
END
$verify$;
