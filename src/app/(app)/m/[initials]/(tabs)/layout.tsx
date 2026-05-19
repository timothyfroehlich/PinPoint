import type React from "react";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import { MachineTabStrip } from "~/components/machines/MachineTabStrip";
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
  const { machine } = await getMachineForLayout(initials);

  if (!machine) {
    notFound();
  }

  // `machine.issues` is open-only — filtered at the DB layer in `_data.ts`.
  const maintenance = {
    openCount: machine.issues.length,
    status: deriveMachineStatus(machine.issues),
  };

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <MachineDetailHeader machine={machine} />
        <MachineTabStrip
          initials={machine.initials}
          maintenance={maintenance}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
