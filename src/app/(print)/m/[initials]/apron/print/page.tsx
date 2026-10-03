import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { machineApronCards, machines, userProfiles } from "~/server/db/schema";
import { createClient } from "~/lib/supabase/server";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { apronCardContent } from "~/lib/machines/apron-card";
import {
  getMachineCredits,
  getMachinePinTips,
} from "~/app/(app)/m/[initials]/_data";
import { buildMachineHubUrl } from "~/lib/machines/hub-url";
import { resolveRequestUrl } from "~/lib/url";
import { ApronCardPrintSheet } from "./ApronCardPrintSheet";

export const metadata: Metadata = { title: "Apron card · PinPoint" };

/**
 * Browser print of one saved apron card (`?card=<id>`) at its exact physical
 * size (spec §9.2), on ordinary paper with crop marks to cut along. Members
 * only (§9.3); always renders the saved state, never a draft (§9.1).
 */
export default async function ApronCardPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ initials: string }>;
  searchParams: Promise<{ card?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  const cardId = z.uuid().safeParse((await searchParams).card);
  if (!cardId.success) notFound();
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
        invitedOwner: { columns: { name: true } },
        apronCards: {
          where: eq(machineApronCards.id, cardId.data),
        },
        pinballmapTitle: {
          columns: {
            name: true,
            machineGroupId: true,
            groupName: true,
            manufacturer: true,
            opdbId: true,
          },
        },
      },
    }),
  ]);
  const card = machine?.apronCards[0];
  if (
    !profile ||
    !checkPermission("machines.apron.export", getAccessLevel(profile.role)) ||
    !machine ||
    !card
  ) {
    notFound();
  }

  return (
    <ApronCardPrintSheet
      machineName={machine.name}
      machineInitials={machine.initials}
      content={apronCardContent(
        machine,
        card,
        await getMachineCredits(machine),
        (await getMachinePinTips(machine.pinballmapTitle?.opdbId ?? null)) !==
          null
      )}
      size={card.size}
      scanUrl={buildMachineHubUrl(
        resolveRequestUrl(await headers()),
        machine.initials
      )}
    />
  );
}
