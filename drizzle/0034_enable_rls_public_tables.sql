-- Close the Supabase Data API exposure gap so Data API can be enabled on
-- prod. Currently OFF on prod, which blocks the Discord integration's
-- PostgREST-based vault decrypt path (/rest/v1/rpc/get_discord_config).
-- Enabling Data API surfaces public-schema tables to the anon and
-- authenticated roles, so every public table needs RLS first.
--
-- Strategy: enable RLS with ZERO policies on these 7 tables. App code
-- accesses them exclusively via Drizzle (POSTGRES_URL superuser, bypasses
-- RLS), so app behavior is unchanged. anon/authenticated PostgREST callers
-- get empty result sets. When a real REST caller appears, that PR adds a
-- narrow policy + regression test. CORE-SEC-006 (email privacy) is the
-- specific reason notifications and notification_preferences need this.

ALTER TABLE "issue_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issue_watchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_watchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Flip public_profiles_view to security_invoker so the email-masking CASE
-- evaluates against the CALLER's session, not the view owner's. The view's
-- existing CASE already keys on auth.uid() / request.user_id /
-- request.user_role, so no logic change is needed beyond this option flip.
-- email-privacy-rls.test.ts validates the admin/member/anon matrix.
ALTER VIEW "public"."public_profiles_view" SET (security_invoker = true);
