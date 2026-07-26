import type React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles, pinballmapCatalog } from "~/server/db/schema";
import {
  getAccessLevel,
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/index";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { getMachineForLayout } from "../_data";
import { MachineDetailsForm } from "./machine-details-form";

/**
 * Machine edit page (/m/[initials]/edit) — PP-o355.19.
 *
 * Replaces the Edit Machine modal. The driver was never size alone: **a page
 * lets sections have different save models.** Details fields belong to one
 * Save; ownership transfer is its own deliberate act; PinballMap operations
 * write to a third-party service, can fail, and need to report — none of which
 * a modal that dismisses on save can do.
 *
 * Deliberately OUTSIDE the `(tabs)` route group: this is a full page with its
 * own header, not another tab on the machine.
 *
 * Removing the Dialog wrapper also removes PP-o355.13's repro path — a Radix
 * popover portalled to <body> being read as an outside-click and dismissing the
 * whole modal.
 */
export default async function MachineEditPage({
  params,
}: {
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

  const currentUserProfile = user
    ? await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      })
    : null;

  const accessLevel = getAccessLevel(currentUserProfile?.role);
  const ownershipContext: OwnershipContext = {
    userId: user?.id,
    machineOwnerId: machine.ownerId ?? undefined,
  };

  // Send anyone who may not edit back to the machine, where the disabled Edit
  // button explains why (edit-button-tooltip). A bare 404 would be a lie — the
  // machine exists, the viewer just cannot edit it.
  if (
    !user ||
    !checkPermission("machines.edit", accessLevel, ownershipContext)
  ) {
    redirect(`/m/${initials}`);
  }

  const canLink = checkPermission(
    "machines.pinballmap.link",
    accessLevel,
    ownershipContext
  );

  const pinballmapTitleName =
    canLink && machine.pinballmapMachineId !== null
      ? ((
          await db.query.pinballmapCatalog.findFirst({
            where: eq(
              pinballmapCatalog.pinballmapMachineId,
              machine.pinballmapMachineId
            ),
            columns: { name: true },
          })
        )?.name ?? null)
      : null;

  return (
    <PageContainer size="narrow">
      <Link
        href={`/m/${machine.initials}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {machine.initials} · {machine.name}
      </Link>

      <PageHeader title={`Edit ${machine.name}`} />

      {/* Details — these fields save together. */}
      <section className="space-y-4" aria-labelledby="section-details">
        <h2 id="section-details" className="text-base font-semibold">
          Details
        </h2>
        <MachineDetailsForm
          machineId={machine.id}
          name={machine.name}
          presenceStatus={machine.presenceStatus}
          description={machine.description}
          canLink={canLink}
          pinballmapMachineId={machine.pinballmapMachineId}
          pinballmapExcluded={machine.pinballmapExcluded}
          pinballmapExcludedReason={machine.pinballmapExcludedReason}
          pinballmapTitleName={pinballmapTitleName}
        />
      </section>
    </PageContainer>
  );
}
