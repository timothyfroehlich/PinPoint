import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import {
  getAccessLevel,
  canAccessMachineManage,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { PageContainer } from "~/components/layout/PageContainer";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import { MachineTabStrip } from "~/components/machines/MachineTabStrip";
import { MachineBackboxTranslite } from "~/components/machines/MachineBackboxTranslite";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getMachineForLayout } from "../_data";

export default async function MachineDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { machine } = await getMachineForLayout(initials);

  if (!machine) {
    notFound();
  }

  // `machine.issues` is open-only — filtered at the DB layer in `_data.ts`.
  const maintenance = {
    openCount: machine.issues.length,
    status: deriveMachineStatus(machine.issues),
  };

  // Manage is reachable either as the full editing surface or as the read-only
  // Pinball Map surface (spec 4.9). The route repeats both checks so a deep link
  // remains guarded; mutation controls keep their own narrower capabilities.
  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };
  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const canManage =
    user !== null && canAccessMachineManage(accessLevel, ownershipContext);

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        {/* Header zone: identity, tab strip, and game artwork. Below md the
            artwork sits beside the identity, above the full-width tab strip.
            From md it spans the identity AND the tab strip, flush to the
            strip's bottom border and the content's right edge. Without
            artwork the auto column collapses and both rows are full width. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 [grid-template-areas:'identity_art'_'tabs_tabs'] md:[grid-template-areas:'identity_art'_'tabs_art']">
          <div className="min-w-0 self-center [grid-area:identity]">
            <MachineDetailHeader machine={machine} />
          </div>
          <div className="min-w-0 [grid-area:tabs]">
            <MachineTabStrip
              initials={machine.initials}
              maintenance={maintenance}
              canManage={canManage}
            />
          </div>
          <MachineBackboxTranslite
            imageUrl={machine.backboxImageUrl}
            name={machine.name}
          />
        </div>
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
