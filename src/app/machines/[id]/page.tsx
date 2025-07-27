import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { MachineDetailView } from "~/components/machines/MachineDetailView";
import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

interface MachinePageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: MachinePageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const machine = await api.machine.core.getById({ id: resolvedParams.id });

    const machineName = machine.name || machine.model.name;

    return {
      title: `${machineName} - PinPoint`,
      description: `${machine.model.name} at ${machine.location.name}`,
      openGraph: {
        title: machineName,
        description: `${machine.model.name} at ${machine.location.name}`,
        type: "article",
      },
    };
  } catch {
    return {
      title: "Machine Not Found - PinPoint",
      description: "The requested machine could not be found.",
    };
  }
}

export default async function MachinePage({
  params,
}: MachinePageProps): Promise<React.JSX.Element> {
  const session = await auth();

  try {
    // Fetch machine data on the server
    const resolvedParams = await params;
    const machine = await api.machine.core.getById({ id: resolvedParams.id });

    // Check if user has permission to view this machine
    // For now, we'll allow public access and let the component handle permissions

    return (
      <main aria-label="Machine details">
        <MachineDetailView
          machine={machine}
          session={session}
          machineId={resolvedParams.id}
        />
      </main>
    );
  } catch {
    // If machine doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
