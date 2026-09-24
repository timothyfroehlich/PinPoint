import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { apronCardContent, buildApronScanUrl } from "~/lib/machines/apron-card";
import { resolveRequestUrl } from "~/lib/url";
import { ApronCardPrintSheet } from "./ApronCardPrintSheet";

export const metadata: Metadata = { title: "Apron card · PinPoint" };

/**
 * Browser print of a saved apron card at its exact physical size (spec
 * §9.2), on ordinary paper with crop marks to cut along. Members only (§9.3); always renders the saved state, never a draft.
 */
export default async function ApronCardPrintPage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [profile, machine] = await Promise.all([
    db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    }),
    db.query.machines.findFirst({
      where: eq(machines.initials, initials),
      with: {
        owner: { columns: { name: true } },
        pinballmapTitle: {
          columns: { name: true, machineGroupId: true, groupName: true },
        },
      },
    }),
  ]);
  if (
    !profile ||
    !checkPermission("machines.apron.export", getAccessLevel(profile.role)) ||
    !machine?.apronSize ||
    !machine.apronSavedAt
  ) {
    notFound();
  }

  return (
    <ApronCardPrintSheet
      machineName={machine.name}
      machineInitials={machine.initials}
      content={apronCardContent(machine)}
      size={machine.apronSize}
      scanUrl={buildApronScanUrl(
        resolveRequestUrl(await headers()),
        machine.initials
      )}
    />
  );
}
