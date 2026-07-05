import type React from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getMachineSettingsSets } from "~/lib/machines/settings-queries";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { SettingsTab } from "~/components/machines/settings/SettingsTab";

/**
 * Soft-keyboard resilience (PP-a0pl, scoped to this settings-heavy page).
 *
 * The default `interactive-widget=resizes-visual` lets the on-screen keyboard
 * cover content: it shrinks only the *visual* viewport, so the layout doesn't
 * move and a focused editor / the RowEditSheet inputs / the Save-Cancel row can
 * end up hidden behind the keyboard. `resizes-content` shrinks the *layout*
 * viewport instead, so content reflows above the keyboard.
 *
 * Cross-browser: honored by Chromium (Chrome/Edge/Android); iOS Safari ignores
 * `interactive-widget` and keeps its own default focus-scroll — so this is a
 * strict improvement on Chromium and a harmless no-op on iOS. App-wide rollout,
 * the §19 Baseline write-up, and real-device iOS verification ride with PP-a0pl.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

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

  const canEdit = checkPermission(
    "machines.settings.manage",
    getAccessLevel(profile?.role),
    { userId: user?.id, machineOwnerId: machine.owner?.id ?? null }
  );

  const sets = await getMachineSettingsSets(db, machine.id);

  return (
    <div className="space-y-6">
      <SettingsTab
        canEdit={canEdit}
        machineId={machine.id}
        initialSets={sets}
        settingsRequests={machine.settingsRequests ?? null}
        settingsInstructions={machine.settingsInstructions ?? null}
      />
    </div>
  );
}
