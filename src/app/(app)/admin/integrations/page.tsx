import type React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { DiscordConfigForm } from "./discord/discord-config-form";
import { IntegrationsDirtyStateProvider } from "./integrations-dirty-state";

export default async function AdminIntegrationsPage(): Promise<React.JSX.Element> {
  const discordConfig = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
    columns: {
      guildId: true,
      inviteLink: true,
      botTokenVaultId: true,
    },
  });

  return (
    <IntegrationsDirtyStateProvider>
      <PageContainer size="narrow">
        <PageHeader title="Integrations" />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Discord</CardTitle>
              <CardDescription>Bot notifications.</CardDescription>
              <CardAction>
                <Link
                  href="/help/discord"
                  className="flex items-center gap-1.5 text-sm text-link"
                >
                  <HelpCircle aria-hidden />
                  <span>Help</span>
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              <DiscordConfigForm
                guildId={discordConfig?.guildId ?? ""}
                inviteLink={discordConfig?.inviteLink ?? ""}
                hasToken={!!discordConfig?.botTokenVaultId}
              />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </IntegrationsDirtyStateProvider>
  );
}
