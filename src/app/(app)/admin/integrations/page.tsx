import type React from "react";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { discordIntegrationConfig } from "~/server/db/schema";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { HelpLink } from "~/components/help/HelpLink";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  SectionNavLayout,
  type SectionNavItem,
} from "~/components/layout/SectionNav";
import { SectionAnchor } from "~/components/machines/machine-form/SectionAnchor";
import { ActivitySummaryForm } from "./discord/activity-summary-form";
import { DiscordConfigForm } from "./discord/discord-config-form";
import { IntegrationsDirtyStateProvider } from "./integrations-dirty-state";
import { PinballMapConfigForm } from "./pinballmap/pinballmap-config-form";
import { getPinballMapAdminViewState } from "./pinballmap/read-model";
import { INTEGRATIONS_SECTION_IDS } from "./section-ids";
import {
  DEFAULT_ACTIVITY_SUMMARY_EVENTS,
  DEFAULT_ACTIVITY_SUMMARY_INTERVAL_HOURS,
  DEFAULT_ACTIVITY_SUMMARY_START_HOUR,
} from "~/lib/discord/activity-summary/events";
import type { ActivitySummaryViewState } from "./discord/types";

/** The page's section list, in page order. */
const SECTIONS: SectionNavItem[] = [
  { id: INTEGRATIONS_SECTION_IDS.discord, label: "Discord" },
  {
    id: INTEGRATIONS_SECTION_IDS.discordConnection,
    label: "Connection",
    depth: 2,
  },
  {
    id: INTEGRATIONS_SECTION_IDS.activitySummary,
    label: "Activity summary",
    depth: 2,
  },
  { id: INTEGRATIONS_SECTION_IDS.pinballMap, label: "Pinball Map" },
  {
    id: INTEGRATIONS_SECTION_IDS.pinballMapLocation,
    label: "Location",
    depth: 2,
  },
  {
    id: INTEGRATIONS_SECTION_IDS.regionAlerts,
    label: "Region alerts",
    depth: 2,
  },
];

export default async function AdminIntegrationsPage(): Promise<React.JSX.Element> {
  const [discordConfig, pinballMapState] = await Promise.all([
    db.query.discordIntegrationConfig.findFirst({
      where: eq(discordIntegrationConfig.id, "singleton"),
      columns: {
        guildId: true,
        inviteLink: true,
        botTokenVaultId: true,
        summaryChannelId: true,
        summaryIntervalHours: true,
        summaryStartHour: true,
        summaryEvents: true,
        summaryStatus: true,
        summaryStatusDetail: true,
        summaryLastPostAt: true,
      },
    }),
    getPinballMapAdminViewState(),
  ]);

  // A missing singleton row reads as the column defaults (spec §2.2).
  const activitySummary: ActivitySummaryViewState = discordConfig
    ? {
        channelId: discordConfig.summaryChannelId,
        intervalHours: discordConfig.summaryIntervalHours,
        startHour: discordConfig.summaryStartHour,
        events: discordConfig.summaryEvents,
        status: discordConfig.summaryStatus,
        statusDetail: discordConfig.summaryStatusDetail,
        lastPostAtIso: discordConfig.summaryLastPostAt?.toISOString() ?? null,
      }
    : {
        channelId: null,
        intervalHours: DEFAULT_ACTIVITY_SUMMARY_INTERVAL_HOURS,
        startHour: DEFAULT_ACTIVITY_SUMMARY_START_HOUR,
        events: DEFAULT_ACTIVITY_SUMMARY_EVENTS,
        status: "not_configured",
        statusDetail: null,
        lastPostAtIso: null,
      };

  return (
    <IntegrationsDirtyStateProvider>
      <PageContainer size="standard">
        <PageHeader title="Integrations" />

        <SectionNavLayout sections={SECTIONS}>
          <div className="flex flex-col gap-6">
            <Card data-testid="discord-integration-card">
              <SectionAnchor id={INTEGRATIONS_SECTION_IDS.discord} />
              <CardHeader>
                <CardTitle>Discord</CardTitle>
                <CardDescription>Bot notifications.</CardDescription>
                <CardAction>
                  <HelpLink
                    href="/help/discord"
                    topic="Discord"
                    className="text-sm"
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-6">
                <section
                  className="space-y-4"
                  aria-labelledby="discord-connection-heading"
                >
                  <SectionAnchor
                    id={INTEGRATIONS_SECTION_IDS.discordConnection}
                  />
                  <h3 id="discord-connection-heading" className="font-medium">
                    Connection
                  </h3>
                  <DiscordConfigForm
                    guildId={discordConfig?.guildId ?? ""}
                    inviteLink={discordConfig?.inviteLink ?? ""}
                    hasToken={!!discordConfig?.botTokenVaultId}
                  />
                </section>

                <Separator />

                <section
                  className="space-y-4"
                  aria-labelledby="discord-activity-summary-heading"
                >
                  <SectionAnchor
                    id={INTEGRATIONS_SECTION_IDS.activitySummary}
                  />
                  <h3
                    id="discord-activity-summary-heading"
                    className="font-medium"
                  >
                    Activity summary
                  </h3>
                  <ActivitySummaryForm initialState={activitySummary} />
                </section>
              </CardContent>
            </Card>

            <Card data-testid="pinballmap-integration-card">
              <SectionAnchor id={INTEGRATIONS_SECTION_IDS.pinballMap} />
              <CardHeader>
                <CardTitle>Pinball Map</CardTitle>
                <CardDescription>
                  Syncs the tracked location&apos;s lineup and watches a region
                  for new machines.
                </CardDescription>
                <CardAction>
                  <HelpLink
                    href="/help/pinball-map"
                    topic="Pinball Map"
                    className="text-sm"
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <PinballMapConfigForm initialState={pinballMapState} />
              </CardContent>
            </Card>
          </div>
        </SectionNavLayout>
      </PageContainer>
    </IntegrationsDirtyStateProvider>
  );
}
