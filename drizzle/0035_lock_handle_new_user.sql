-- Defense-in-depth: revoke EXECUTE on public.handle_new_user() from
-- anon and authenticated roles. Migration 0007 created the trigger function
-- as SECURITY DEFINER with search_path = public (correct), but did not
-- explicitly restrict callers. This mirrors the pattern established in
-- migration 0029 for get_discord_config().
--
-- handle_new_user() is only ever invoked by the on_auth_user_created trigger
-- (AFTER INSERT ON auth.users), which runs as the definer regardless. Direct
-- RPC calls from anon/authenticated serve no legitimate purpose.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
