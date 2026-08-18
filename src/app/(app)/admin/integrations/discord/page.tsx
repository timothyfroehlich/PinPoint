import { redirect } from "next/navigation";

/**
 * The Discord admin config moved from its own page into a section on the
 * combined Admin Integrations page (spec §2 — one page, no per-integration
 * route). This route is kept only to redirect any bookmark or stale link to
 * the new home; the form itself lives in `../discord-section.tsx`.
 */
export default function AdminDiscordIntegrationRedirect(): never {
  redirect("/admin/integrations");
}
