import type React from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { ApronCardTab } from "~/components/machines/apron/ApronCardTab";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { apronCardIdentity } from "~/lib/machines/apron-card";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { resolveRequestUrl } from "~/lib/url";
import {
  getMachineApronCards,
  getMachineCredits,
  getMachineForLayout,
  getMachinePinTips,
} from "~/app/(app)/m/[initials]/_data";

/**
 * Machine Apron card tab (/m/[initials]/apron) — the machine's saved apron
 * cards, edited with their own Save (spec apron-cards §3.1, §11). Every
 * signed-in member sees it; without the machine-management capability it is
 * Preview and Export only (§3.8, §9.3).
 */
export default async function MachineApronCardPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  const { machine } = await getMachineForLayout(initials);
  if (!machine) notFound();

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
  const accessLevel = getAccessLevel(profile?.role);
  // Deep-link guard: the tab is hidden from anyone who cannot export (§9.3).
  if (!checkPermission("machines.apron.export", accessLevel)) {
    redirect(`/m/${initials}`);
  }
  const canEdit = checkPermission("machines.edit", accessLevel, {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  });

  const [savedCards, credits, pinTips] = await Promise.all([
    getMachineApronCards(machine.id),
    getMachineCredits(machine),
    getMachinePinTips(machine.pinballmapTitle?.opdbId ?? null),
  ]);

  return (
    <ApronCardTab
      machineId={machine.id}
      machineInitials={machine.initials}
      identity={apronCardIdentity(machine, credits, pinTips !== null)}
      mainDescription={machine.description}
      savedCards={savedCards}
      scanUrl={buildMachineHubUrl(
        resolveRequestUrl(await headers()),
        machine.initials
      )}
      canEdit={canEdit}
    />
  );
}
