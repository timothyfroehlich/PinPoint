import type React from "react";
import { redirect } from "next/navigation";
import { getViewer } from "~/lib/auth/viewer";
import { getLoginUrl } from "~/lib/url";
import { PageHeader } from "~/components/layout/PageHeader";
import { CreateMachineForm } from "./create-machine-form";
import { PageContainer } from "~/components/layout/PageContainer";
import { db } from "~/server/db";
import { pinballmapCatalog } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Forbidden } from "~/components/errors/Forbidden";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

import { getUnifiedUsers } from "~/lib/users/queries";
import { isIscoredConfigured } from "~/lib/iscored/config";
import { getPinballMapState } from "~/lib/pinballmap/state";
import { getPinballMapLinkStatus } from "~/lib/pinballmap/user-credentials";
import { insiderConnectedSetting } from "~/lib/pinballmap/insider-connected";

/**
 * Create Machine Page (Protected Route)
 *
 * Form to create a new pinball machine.
 * Mutates through a Server Action.
 */
export default async function NewMachinePage({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string | string[];
    pbm?: string | string[];
  }>;
}): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const { userId, role } = await getViewer();

  if (!userId) {
    redirect(getLoginUrl("/m/new"));
  }

  const canCreateMachine = checkPermission(
    "machines.create",
    getAccessLevel(role)
  );

  if (!canCreateMachine) {
    return <Forbidden role={role} backUrl="/m" />;
  }

  // CORE-SEC-006: Map to minimal shape before passing to client components
  const allUsersRaw = await getUnifiedUsers({ includeEmails: false });
  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    name: u.name,
    lastName: u.lastName,
    machineCount: u.machineCount,
    status: u.status,
    role: u.role,
  }));

  const iscoredConfigured = isIscoredConfigured();
  // `?title=` prefills the name and `?pbm=` the Pinball Map title, for the
  // lineup page's Create in PinPoint.
  const { title, pbm } = await searchParams;
  const pbmId = typeof pbm === "string" ? Number.parseInt(pbm, 10) : NaN;
  const initialPinballmap = Number.isSafeInteger(pbmId)
    ? await db.query.pinballmapCatalog.findFirst({
        columns: { pinballmapMachineId: true, name: true },
        where: eq(pinballmapCatalog.pinballmapMachineId, pbmId),
      })
    : undefined;
  const accessLevel = getAccessLevel(role);

  // What the lineup choice needs (pinballmap 4.11). The creator owns no
  // machine yet, so these are the role-level capabilities — the same ones the
  // create action and the add push re-check on the server.
  const canPush = checkPermission("machines.pinballmap.push", accessLevel);
  const [pbmState, pbmLink] = await Promise.all([
    getPinballMapState(),
    // The add runs as the creator's own linked account (8.2), read off the
    // link row without decrypting it — the Manage tab's test (CORE-ARCH-012).
    canPush
      ? getPinballMapLinkStatus(userId)
      : Promise.resolve({ status: "not_linked" } as const),
  ]);
  const configured = pbmState?.locationId != null;
  const pinballmap = {
    configured,
    locationName: configured ? (pbmState.snapshotJson?.name ?? null) : null,
    canSetIntent: checkPermission("machines.pinballmap.link", accessLevel),
    canAddAfterCreate: configured && canPush && pbmLink.status === "linked",
    // The lineup's entries: a title already on it is not offered the add,
    // and starts Insider Connected at the entry's value (4.11).
    lineup: configured
      ? (pbmState.snapshotJson?.lmxes.map((lmx) => ({
          titleId: lmx.machineId,
          insiderConnected: insiderConnectedSetting(lmx.icEnabled),
        })) ?? [])
      : [],
  };

  return (
    // No card around the form: it sits on the page as the Manage tab's form
    // does, under the page title (Tim, PP-wqit.14.2 review).
    <PageContainer size="standard" className="pt-4 pb-8">
      <div className="max-w-4xl space-y-6">
        <PageHeader title="New Machine" />
        <CreateMachineForm
          allUsers={allUsers}
          canSelectOwner={canCreateMachine}
          iscoredConfigured={iscoredConfigured}
          canViewOwnerRequirements={checkPermission(
            "machines.view.ownerRequirements",
            accessLevel
          )}
          pinballmap={pinballmap}
          initialName={typeof title === "string" ? title : undefined}
          initialPinballmap={
            initialPinballmap
              ? {
                  id: initialPinballmap.pinballmapMachineId,
                  name: initialPinballmap.name,
                }
              : undefined
          }
        />
      </div>
    </PageContainer>
  );
}
