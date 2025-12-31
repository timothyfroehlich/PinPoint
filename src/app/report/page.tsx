import type React from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";
import { MainLayout } from "~/components/layout/MainLayout";
import { resolveDefaultMachineId } from "./default-machine";
import { UnifiedReportForm } from "./unified-report-form";
import { createClient } from "~/lib/supabase/server";

// Avoid SSG hitting Supabase during builds that run parallel to db resets
export const dynamic = "force-dynamic";

export default async function PublicReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    machine?: string;
    machineId?: string;
    source?: string;
  }>;
}): Promise<React.JSX.Element> {
  const machinesList = await db.query.machines.findMany({
    orderBy: asc(machines.name),
    columns: { id: true, name: true, initials: true },
  });

  const params = await searchParams;
  const errorMessage = params.error
    ? decodeURIComponent(params.error)
    : undefined;

  const machineIdFromQuery = params.machineId;
  const machineInitialsFromQuery = params.machine;

  const defaultMachineId = resolveDefaultMachineId(
    machinesList,
    machineIdFromQuery,
    machineInitialsFromQuery
  );

  // Auth context for the form
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile;
  if (user) {
    userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
  }

  return (
    <MainLayout>
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <UnifiedReportForm
          machinesList={machinesList}
          defaultMachineId={defaultMachineId}
          user={user}
          userProfile={userProfile}
          initialError={errorMessage}
        />
      </div>
    </MainLayout>
  );
}
