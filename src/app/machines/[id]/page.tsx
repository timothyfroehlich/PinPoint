/**
 * Machine Detail Page - Phase 3B Server Component Architecture
 * Converted from tRPC to Server Components + DAL pattern
 */

import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireMemberAccess } from "~/lib/organization-context";
import { getMachineById } from "~/lib/dal/machines";
import { MachineDetailServer } from "~/components/machines/machine-detail-server";
import { MachineHeader } from "~/components/machines/machine-header";
import { MachineQRCodeClient } from "~/components/machines/client/machine-qr-code-client";

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
    const machine = await getMachineById(resolvedParams.id);

    const machineName = machine.name || "Unknown Machine";

    return {
      title: `${machineName} - Machine Inventory - PinPoint`,
      description: `${machine.model?.name || "Machine"} at ${machine.location?.name || "Unknown Location"}`,
      openGraph: {
        title: machineName,
        description: `${machine.model?.name || "Machine"} at ${machine.location?.name || "Unknown Location"}`,
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

export default async function MachinePage({ params }: MachinePageProps) {
  // Ensure user is authenticated and get organization context
  await requireMemberAccess();

  try {
    const resolvedParams = await params;
    const machine = await getMachineById(resolvedParams.id);

    return (
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        {/* Server-rendered machine header */}
        <MachineHeader machine={machine} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Server-rendered machine details */}
            <Suspense
              fallback={
                <div className="rounded-lg border p-6 space-y-4">
                  <div className="h-6 bg-muted animate-pulse rounded w-1/3" />
                  <div className="space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                  </div>
                </div>
              }
            >
              <MachineDetailServer machine={machine} />
            </Suspense>
          </div>

          <div className="space-y-4">
            {/* Client island for QR code management */}
            <MachineQRCodeClient
              machineId={machine.id}
              qrCodeUrl={machine.qr_code_url}
              qrCodeGeneratedAt={machine.qr_code_generated_at}
              machineName={machine.name}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Machine detail error:", error);
    notFound();
  }
}
