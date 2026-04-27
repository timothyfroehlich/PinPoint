import type React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DiscordConfigForm } from "./discord-config-form";
import { TestDmButton } from "./test-dm-button";

export default async function AdminDiscordIntegrationPage(): Promise<React.JSX.Element> {
  const config = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });

  const hasToken = !!config?.botTokenVaultId;

  return (
    <PageContainer size="standard">
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

      <div className="flex flex-col gap-6">
        {/* Status banner — full width, horizontal on lg+ */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8 lg:gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Feature:</span>
              {config?.enabled ? (
                <Badge className="bg-success/15 text-success border-success/40">
                  Enabled
                </Badge>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Bot token:</span>
              {hasToken ? (
                <Badge className="bg-success/15 text-success border-success/40">
                  Set
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-warning/40 text-warning"
                >
                  Missing
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration (2/3) + Test (1/3) on lg+, stacked otherwise */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <DiscordConfigForm
                enabled={config?.enabled ?? false}
                guildId={config?.guildId ?? ""}
                inviteLink={config?.inviteLink ?? ""}
                hasToken={hasToken}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test connection</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Verifies that the bot token is valid by calling Discord&apos;s
                <code className="mx-1">/users/@me</code> endpoint. To send a
                real DM end-to-end, link your own Discord account in{" "}
                <strong>Settings → Connected Accounts</strong> and use the{" "}
                <strong>Send test DM</strong> button there.
              </p>
              <TestDmButton disabled={!config?.enabled || !hasToken} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
