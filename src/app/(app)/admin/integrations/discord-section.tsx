import type React from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { DiscordConfigForm } from "./discord/discord-config-form";

/**
 * The Discord integration's section on the Admin Integrations page (spec §3).
 *
 * Preserves the existing Discord behavior unchanged (§3.1): the same
 * `DiscordConfigForm` with its own fields, validation, copy, and independent
 * save (§2.3). The only change from the former standalone `/admin/integrations/
 * discord` page is the frame — the form now lives inside the shared
 * `IntegrationSection` beside the Pinball Map section. Help link preserved
 * (§3.2).
 */
export async function DiscordSection(): Promise<React.JSX.Element> {
  const config = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });

  // The form owns the frame: its enable toggle renders on the section heading
  // line (IntegrationSection's `action` slot), and that toggle is driven by the
  // form's own dirty state, so it cannot be lifted out into this Server
  // Component. IntegrationSection is presentational and client-safe.
  return (
    <DiscordConfigForm
      enabled={config?.enabled ?? false}
      guildId={config?.guildId ?? ""}
      inviteLink={config?.inviteLink ?? ""}
      hasToken={!!config?.botTokenVaultId}
    />
  );
}
