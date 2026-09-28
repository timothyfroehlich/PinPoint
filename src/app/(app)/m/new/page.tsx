import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { CreateMachineForm } from "./create-machine-form";
import { PageContainer } from "~/components/layout/PageContainer";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Forbidden } from "~/components/errors/Forbidden";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

import { getUnifiedUsers } from "~/lib/users/queries";
import { isIscoredConfigured } from "~/lib/iscored/config";
import { getPinballMapState } from "~/lib/pinballmap/state";

/**
 * Create Machine Page (Protected Route)
 *
 * Form to create a new pinball machine.
 * Mutates through a Server Action.
 */
export default async function NewMachinePage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginUrl("/m/new"));
  }

  // Fetch all users for owner selection (Admin and Technician)
  const currentUserProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  const canCreateMachine = checkPermission(
    "machines.create",
    getAccessLevel(currentUserProfile?.role)
  );

  if (!canCreateMachine) {
    return <Forbidden role={currentUserProfile?.role ?? null} backUrl="/m" />;
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
  const accessLevel = getAccessLevel(currentUserProfile?.role);

  // What the lineup choice needs (pinballmap 4.11). The creator owns no
  // machine yet, so these are the role-level capabilities — the same ones the
  // create action and the add push re-check on the server.
  const pbmState = await getPinballMapState();
  const configured = pbmState?.locationId != null;
  // Whether an operator credential exists, read off the state row without
  // decrypting it — the same test the Manage tab uses (CORE-ARCH-012).
  const writeEnabled =
    configured &&
    pbmState.outboundEmail != null &&
    pbmState.outboundTokenVaultId != null;
  const pinballmap = {
    configured,
    locationName: configured ? (pbmState.snapshotJson?.name ?? null) : null,
    canSetIntent: checkPermission("machines.pinballmap.link", accessLevel),
    canAddAfterCreate:
      writeEnabled && checkPermission("machines.pinballmap.push", accessLevel),
  };

  return (
    <PageContainer size="standard" className="pt-4 pb-8">
      <Card className="max-w-4xl gap-4 border-outline-variant">
        <CardHeader className="px-4 pt-4 pb-0 sm:px-6">
          <CardTitle className="text-xl text-foreground">New Machine</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6">
          <CreateMachineForm
            allUsers={allUsers}
            canSelectOwner={canCreateMachine}
            iscoredConfigured={iscoredConfigured}
            canViewOwnerRequirements={checkPermission(
              "machines.view.ownerRequirements",
              accessLevel
            )}
            pinballmap={pinballmap}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
