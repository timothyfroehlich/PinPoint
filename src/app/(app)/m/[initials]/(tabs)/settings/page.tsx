import type React from "react";
import { notFound } from "next/navigation";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getMachineSettingsSets } from "~/lib/machines/settings-queries";
import { getSettingsTagOptions } from "~/lib/machines/settings-sheet-queries";
import { getViewer } from "~/lib/auth/viewer";
import { db } from "~/server/db";
import { SettingsTab } from "~/components/machines/settings/SettingsTab";

// The soft-keyboard `interactive-widget=resizes-content` viewport now ships
// app-wide from the root layout (src/app/layout.tsx, PP-a0pl) — the per-page
// export that used to live here has been folded into it.

/**
 * Machine Settings Tab (/m/[initials]/settings) — PP-43q3.
 *
 * Server-fetches the machine's settings sets and derives edit permission from
 * the matrix (`machines.settings.manage`: owner / technician / admin). Viewing
 * is public (rides on machines.view); editing is gated.
 */
export default async function MachineSettingsTab({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

  const { userId, role } = await getViewer();

  const access = getAccessLevel(role);
  const machineOwnerId = machine.owner?.id ?? null;

  // Machine-wide gate for the "Add set" button (creating rides on the existing
  // matrix entry); per-set edit rights are computed per row in the query.
  const canCreate = checkPermission("machines.settings.manage", access, {
    userId,
    machineOwnerId,
  });

  const [sets, allTags] = await Promise.all([
    getMachineSettingsSets(db, machine.id, {
      viewerId: userId ?? null,
      access,
      machineOwnerId,
    }),
    getSettingsTagOptions(db),
  ]);

  return (
    <div className="space-y-6">
      <SettingsTab
        canCreate={canCreate}
        viewerId={userId ?? null}
        machineOwnerId={machineOwnerId}
        machineId={machine.id}
        initialSets={sets}
        settingsRequests={machine.settingsRequests ?? null}
        settingsInstructions={machine.settingsInstructions ?? null}
        allTags={allTags}
        canManageTags={checkPermission("machines.settings.tags.manage", access)}
      />
    </div>
  );
}
