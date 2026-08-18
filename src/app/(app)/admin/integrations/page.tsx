import type React from "react";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import {
  getPinballMapState,
  getRefreshAllowance,
} from "~/lib/pinballmap/state";
import { pinballmapLocationUrl } from "~/lib/pinballmap/public-url";
import { APC_LOCATION_ID } from "~/lib/pinballmap/config";
import { DiscordSection } from "./discord-section";
import { PinballMapSection } from "./pinballmap-section";

/**
 * Admin Integrations — the one admin surface configuring PinPoint's third-party
 * connections, one section per integration (spec §2). Admin-only, enforced by
 * the parent `/admin` layout (§2.2). Sections render in a fixed order in the
 * same frame (§2.4); each owns its own save/reset (§2.3).
 *
 * A Server Component: it loads each integration's stored state and hands it to
 * the sections. Discord loads its own config inside `DiscordSection`; the
 * Pinball Map singleton (state + refresh allowance) is loaded here and passed
 * to the client leaf as plain serializable props.
 */
export default async function AdminIntegrationsPage(): Promise<React.JSX.Element> {
  const [state, allowance] = await Promise.all([
    getPinballMapState(),
    getRefreshAllowance(),
  ]);
  const locationId = state?.locationId ?? APC_LOCATION_ID;

  return (
    <PageContainer size="narrow">
      <PageHeader title="Integrations" />
      <div className="space-y-6">
        <DiscordSection />
        <PinballMapSection
          enabled={state?.enabled ?? false}
          locationId={locationId}
          locationUrl={pinballmapLocationUrl(locationId)}
          health={{
            lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
            lastSyncAttemptAt: state?.lastSyncAttemptAt?.toISOString() ?? null,
            lastSyncStatus: state?.lastSyncStatus ?? "unknown",
            lastSyncError: state?.lastSyncError ?? null,
            machineCount: state?.snapshotJson?.machineCount ?? null,
          }}
          allowance={{
            remaining: allowance.remaining,
            nextRefillAt: allowance.nextRefillAt?.toISOString() ?? null,
          }}
        />
      </div>
    </PageContainer>
  );
}
