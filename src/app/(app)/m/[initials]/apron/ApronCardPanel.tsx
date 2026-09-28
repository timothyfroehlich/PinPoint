import type React from "react";
import { headers } from "next/headers";

import { ApronCardEntry } from "~/components/machines/apron/ApronCardEntry";
import { apronCardContent } from "~/lib/machines/apron-card";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { docToPlainText } from "~/lib/tiptap/types";
import { resolveRequestUrl } from "~/lib/url";
import {
  getMachineCredits,
  type MachineForLayout,
} from "~/app/(app)/m/[initials]/_data";

/** Server wrapper: resolves the scan URL and the saved card for the entry. */
export async function ApronCardPanel({
  machine,
  variant,
  canEdit,
  canExport,
}: {
  machine: MachineForLayout;
  variant: "rail" | "row";
  canEdit: boolean;
  canExport: boolean;
}): Promise<React.JSX.Element | null> {
  if (!canEdit && !canExport) return null;

  const scanUrl = buildMachineHubUrl(
    resolveRequestUrl(await headers()),
    machine.initials
  );
  const credits = await getMachineCredits(
    machine.pinballmapTitle?.opdbId ?? null
  );
  const { name, edition, manufacturer, year, ownerName } = apronCardContent(
    machine,
    credits
  );

  return (
    <ApronCardEntry
      variant={variant}
      machineId={machine.id}
      machineInitials={machine.initials}
      identity={{ name, edition, manufacturer, year, ownerName, credits }}
      mainDescription={docToPlainText(machine.description)}
      saved={{
        size: machine.apronSize,
        useCustomDescription: machine.apronUseCustomDescription,
        customDescription: machine.apronDescription ?? "",
        tip: machine.apronTip ?? "",
        tipEnabled: machine.apronTipEnabled,
        designEnabled: machine.apronDesignEnabled,
        artEnabled: machine.apronArtEnabled,
      }}
      savedAt={machine.apronSavedAt?.toISOString() ?? null}
      scanUrl={scanUrl}
      canEdit={canEdit}
      canExport={canExport}
    />
  );
}
