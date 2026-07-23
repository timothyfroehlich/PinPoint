import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getMachineSettingsSets } from "~/lib/machines/settings-queries";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const access = getAccessLevel(profile?.role);
  const machineOwnerId = machine.owner?.id ?? null;

  // Machine-wide gate for the "Add set" button (creating rides on the existing
  // matrix entry); per-set edit rights are computed per row in the query.
  const canCreate = checkPermission("machines.settings.manage", access, {
    userId: user?.id,
    machineOwnerId,
  });

  const sets = await getMachineSettingsSets(db, machine.id, {
    viewerId: user?.id ?? null,
    access,
    machineOwnerId,
  });

  return (
    <div className="space-y-6">
      <SettingsTab
        canCreate={canCreate}
        viewerId={user?.id ?? null}
        machineOwnerId={machineOwnerId}
        ownerName={machine.owner?.name ?? null}
        machineId={machine.id}
        initialSets={sets}
        settingsRequests={machine.settingsRequests ?? null}
        settingsInstructions={machine.settingsInstructions ?? null}
      />
    </div>
  );
}
