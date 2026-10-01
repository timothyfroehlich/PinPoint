-- PP-o355.6: retire the shared Pinball Map operator credential. Pushes now run
-- as each member's own linked account (pinballmap_user_credentials, 0096), so
-- nothing reads the operator token, and a decryptable write credential with no
-- consumer is attack surface for no benefit.
--
-- Expand/contract, like 0085: this migration removes the secret but keeps the
-- two pointer columns and the decrypt RPC, because the deployment still serving
-- while this one builds selects the columns by name and calls the RPC on every
-- push. With the secret gone the RPC returns no token, so it can no longer
-- decrypt anything. A follow-up contract migration (PP-o355.64) drops
-- outbound_email, outbound_token_vault_id, and get_pinballmap_credentials().

-- 1. Delete the operator's Vault secret while the pointer still names it.
--    Wrapped like 0059: Postgres checks the table ACL at execution time, not
--    per row, so a preview DB whose migrating role lacks DELETE on vault.secrets
--    would fail the deploy even with nothing to delete. An orphaned encrypted
--    secret there is better than a broken deploy; only insufficient_privilege
--    is swallowed.
DO $$ BEGIN
  DELETE FROM vault.secrets
   WHERE id IN (
     SELECT outbound_token_vault_id
       FROM pinballmap_state
      WHERE outbound_token_vault_id IS NOT NULL
   );
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'skipping vault secret cleanup: no DELETE privilege on vault.secrets';
END $$;--> statement-breakpoint

-- 2. Clear the pointers, so nothing names a deleted secret until the drop.
UPDATE pinballmap_state
   SET outbound_email = NULL,
       outbound_token_vault_id = NULL
 WHERE outbound_email IS NOT NULL
    OR outbound_token_vault_id IS NOT NULL;
