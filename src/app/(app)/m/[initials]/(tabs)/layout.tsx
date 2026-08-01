import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
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

  // The Manage tab is only rendered for viewers who hold `machines.edit`; the
  // Edit route re-checks the same permission so a deep link is still guarded.
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
  const canEdit =
    user !== null &&
    checkPermission(
      "machines.edit",
      getAccessLevel(currentUserProfile?.role),
      ownershipContext
    );

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        {/* Header zone: identity + tab strip in a left column, with the
            desktop-only translite stretched alongside both (it spans the
            header AND the tab strip, flush to the strip's bottom border and
            the content's right edge). Mobile: single column, translite
            hidden — unchanged from the plain stacked layout. */}
        <div className="md:flex md:items-stretch">
          <div className="min-w-0 flex-1 space-y-2">
            <MachineDetailHeader machine={machine} />
            <MachineTabStrip
              initials={machine.initials}
              maintenance={maintenance}
              canEdit={canEdit}
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
