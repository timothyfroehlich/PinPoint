import type React from "react";
import { notFound } from "next/navigation";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import {
  getGameUrl,
  getScoreEntryUrl,
  getTopScoresForMachine,
} from "~/lib/iscored";
import { MachineScanHub } from "./machine-scan-hub";

export const dynamic = "force-dynamic";

export default async function MachineScanHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ initials: string }>;
  searchParams: Promise<{ source?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;
  const { source } = await searchParams;
  const { machine } = await getMachineForLayout(initials);
  if (!machine) notFound();

  const scores = machine.iscoredGameId
    ? await getTopScoresForMachine(machine.iscoredGameId, 3)
    : [];

  return (
    <MachineScanHub
      machine={{
        initials: machine.initials,
        name: machine.name,
        manufacturer: machine.currentManufacturer,
        year: machine.year,
        owner: machine.owner ? { name: machine.owner.name } : null,
        invitedOwner: machine.invitedOwner
          ? { name: machine.invitedOwner.name }
          : null,
        iscoredGameId: machine.iscoredGameId,
        issues: machine.issues.map((issue) => ({
          id: issue.id,
          severity: issue.severity,
          title: issue.title,
          createdAt: issue.createdAt,
        })),
      }}
      scores={scores}
      scoreHref={
        machine.iscoredGameId ? getScoreEntryUrl(machine.iscoredGameId) : null
      }
      gameHref={
        machine.iscoredGameId ? getGameUrl(machine.iscoredGameId) : null
      }
      fromApron={source === "apron"}
    />
  );
}
