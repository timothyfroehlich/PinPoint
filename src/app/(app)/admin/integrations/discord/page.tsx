import type React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { DiscordConfigForm } from "./discord-config-form";

export default async function AdminDiscordIntegrationPage(): Promise<React.JSX.Element> {
  const config = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Discord Integration"
        actions={
          <Link
            href="/help/discord"
            className="flex items-center gap-1.5 text-sm text-link"
          >
            <HelpCircle className="size-4" aria-hidden />
            <span>Help</span>
          </Link>
        }
      />

      <DiscordConfigForm
        enabled={config?.enabled ?? false}
        guildId={config?.guildId ?? ""}
        inviteLink={config?.inviteLink ?? ""}
        hasToken={!!config?.botTokenVaultId}
      />
    </PageContainer>
  );
}
