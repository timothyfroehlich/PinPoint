import type React from "react";
import { headers } from "next/headers";

import { ApronCardEntry } from "~/components/machines/apron/ApronCardEntry";
import { apronCardContent } from "~/lib/machines/apron-card";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { docToPlainText } from "~/lib/tiptap/types";
import { resolveRequestUrl } from "~/lib/url";
import {
  getMachineCredits,
  getMachinePinTips,
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
  const [credits, pinTips] = await Promise.all([
    getMachineCredits(machine),
    getMachinePinTips(machine.pinballmapTitle?.opdbId ?? null),
  ]);
  const hasPinTips = pinTips !== null;
  const card = machine.apronCards[0] ?? null;
  const { name, edition, manufacturer, year, ownerName } = apronCardContent(
    machine,
    card,
    credits,
    hasPinTips
  );

  return (
    <ApronCardEntry
      variant={variant}
      machineId={machine.id}
      machineInitials={machine.initials}
      identity={{
        name,
        edition,
        manufacturer,
        year,
        ownerName,
        credits,
        hasPinTips,
      }}
      mainDescription={docToPlainText(machine.description)}
      saved={{
        size: card?.size ?? null,
        useCustomDescription: card?.useCustomDescription ?? false,
        customDescription: docToPlainText(card?.description),
        tip: docToPlainText(card?.tip),
        tipEnabled: card?.tipEnabled ?? false,
        designEnabled: card?.designEnabled ?? true,
        artEnabled: card?.artEnabled ?? true,
      }}
      savedAt={card?.updatedAt.toISOString() ?? null}
      scanUrl={scanUrl}
      canEdit={canEdit}
      canExport={canExport}
    />
  );
}
