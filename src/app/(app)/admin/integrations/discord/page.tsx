import type React from "react";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DiscordConfigForm } from "./discord-config-form";
import { TestDmButton } from "./test-dm-button";
import { formatDate } from "~/lib/dates";

export default async function AdminDiscordIntegrationPage(): Promise<React.JSX.Element> {
  const config = await db.query.discordIntegrationConfig.findFirst({
    where: eq(discordIntegrationConfig.id, "singleton"),
  });

  const hasToken = !!config?.botTokenVaultId;
  const healthStatus = config?.botHealthStatus ?? "unknown";

  return (
    <PageContainer size="standard">
      <PageHeader title="Discord Integration" />

      <div className="flex flex-col gap-6">
        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
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
              <span className="text-sm text-muted-foreground">Bot health:</span>
              <Badge variant="outline">{healthStatus}</Badge>
              {config?.lastBotCheckAt && (
                <span className="text-xs text-muted-foreground">
                  last checked {formatDate(config.lastBotCheckAt)}
                </span>
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

        {/* Configuration */}
        <Card>
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

        {/* Test */}
        <Card>
          <CardHeader>
            <CardTitle>Test connection</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Verifies that the bot token is valid by calling Discord&apos;s
              <code className="mx-1">/users/@me</code> endpoint. Does not send
              an actual DM yet — real DM delivery ships in the next PR.
            </p>
            <TestDmButton disabled={!config?.enabled || !hasToken} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
