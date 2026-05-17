import type React from "react";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { MachineDetailHeader } from "~/components/machines/MachineDetailHeader";
import { MachineTabStrip } from "~/components/machines/MachineTabStrip";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getMachineForLayout } from "./_data";

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

  const closedSet: ReadonlySet<string> = new Set(CLOSED_STATUSES);
  const openIssues = machine.issues.filter((i) => !closedSet.has(i.status));
  const maintenance = {
    openCount: openIssues.length,
    status: deriveMachineStatus(openIssues),
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
