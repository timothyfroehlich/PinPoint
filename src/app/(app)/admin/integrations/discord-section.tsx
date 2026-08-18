import type React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { IntegrationSection } from "./integration-section";
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

  return (
    <IntegrationSection
      title="Discord"
      description="Bot notifications for issues and machine activity."
      action={
        <Link
          href="/help/discord"
          className="flex items-center gap-1.5 text-sm text-link"
        >
          <HelpCircle className="size-4" aria-hidden />
          <span>Help</span>
        </Link>
      }
    >
      <DiscordConfigForm
        enabled={config?.enabled ?? false}
        guildId={config?.guildId ?? ""}
        inviteLink={config?.inviteLink ?? ""}
        hasToken={!!config?.botTokenVaultId}
      />
    </IntegrationSection>
  );
}
