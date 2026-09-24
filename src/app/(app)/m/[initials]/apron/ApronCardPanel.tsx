import type React from "react";
import { headers } from "next/headers";

import { ApronCardEntry } from "~/components/machines/apron/ApronCardEntry";
import { apronCardContent, buildApronScanUrl } from "~/lib/machines/apron-card";
import { docToPlainText } from "~/lib/tiptap/types";
import { resolveRequestUrl } from "~/lib/url";
import type { MachineForLayout } from "~/app/(app)/m/[initials]/_data";

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

  const scanUrl = buildApronScanUrl(
    resolveRequestUrl(await headers()),
    machine.initials
  );
  const { name, edition, manufacturer, year, ownerName } =
    apronCardContent(machine);

  return (
    <ApronCardEntry
      variant={variant}
      machineId={machine.id}
      machineInitials={machine.initials}
      identity={{ name, edition, manufacturer, year, ownerName }}
      mainDescription={docToPlainText(machine.description)}
      saved={{
        size: machine.apronSize,
        useCustomDescription: machine.apronUseCustomDescription,
        customDescription: machine.apronDescription ?? "",
        tip: machine.apronTip ?? "",
        tipEnabled: machine.apronTipEnabled,
      }}
      savedAt={machine.apronSavedAt?.toISOString() ?? null}
      scanUrl={scanUrl}
      canEdit={canEdit}
      canExport={canExport}
    />
  );
}
