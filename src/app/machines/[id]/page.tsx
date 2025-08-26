import { type Metadata } from "next";
import { notFound } from "next/navigation";
import * as React from "react";

import { MachineDetailView } from "~/components/machines/MachineDetailView";
import { getSupabaseUser } from "~/server/auth/supabase";
import { api } from "~/trpc/server";

// Next.js automatically serializes Date objects to ISO strings when passing
// from server components to client components, so we can safely cast the type

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

    const machineName = machine.name || machine.model.name || "Unknown Machine";

    return {
      title: `${machineName} - PinPoint`,
      description: `${machine.model.name || "Unknown Model"} at ${machine.location.name || "Unknown Location"}`,
      openGraph: {
        title: machineName,
        description: `${machine.model.name || "Unknown Model"} at ${machine.location.name || "Unknown Location"}`,
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
  const user = await getSupabaseUser();

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
          user={user}
          machineId={resolvedParams.id}
        />
      </main>
    );
  } catch {
    // If machine doesn't exist or user doesn't have access, show 404
    notFound();
  }
}
