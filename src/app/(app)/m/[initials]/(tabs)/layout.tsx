import type React from "react";
import { notFound } from "next/navigation";
import { getViewer } from "~/lib/auth/viewer";
import {
  getAccessLevel,
  canAccessMachineManage,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { PageContainer } from "~/components/layout/PageContainer";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import { MachineTabStrip } from "~/components/machines/MachineTabStrip";
import { MachineArtworkHero } from "~/components/machines/MachineArtworkHero";
import { MachineHeaderSwitch } from "~/components/machines/MachineHeaderSwitch";
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

  const { userId, role } = await getViewer();

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
  const ownershipContext: OwnershipContext = {
    userId,
    machineOwnerId: machine.ownerId ?? undefined,
  };
  const accessLevel = getAccessLevel(role);
  const canManage =
    userId !== undefined &&
    canAccessMachineManage(accessLevel, ownershipContext);

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <MachineHeaderSwitch
          hero={
            machine.artwork != null ? (
              <MachineArtworkHero machine={machine} />
            ) : null
          }
          header={<MachineDetailHeader machine={machine} />}
        />
        <MachineTabStrip
          initials={machine.initials}
          maintenance={maintenance}
          canManage={canManage}
          canSeeApronCards={checkPermission(
            "machines.apron.export",
            accessLevel
          )}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
