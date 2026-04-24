import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { CreateMachineForm } from "./create-machine-form";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Forbidden } from "~/components/errors/Forbidden";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

import { getUnifiedUsers } from "~/lib/users/queries";

/**
 * Create Machine Page (Protected Route)
 *
 * Form to create a new pinball machine.
 * Uses Server Actions with progressive enhancement (works without JS).
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

  return (
    <PageContainer size="standard">
      <PageHeader title="New Machine" />

      {/* Form */}
      <Card className="max-w-2xl border-outline-variant">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">
            Machine Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMachineForm
            allUsers={allUsers}
            canSelectOwner={canCreateMachine}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
