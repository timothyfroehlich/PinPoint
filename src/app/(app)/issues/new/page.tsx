import type React from "react";
import { Plus } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { CreateIssueForm } from "./create-issue-form";

/**
 * Report New Issue Page (Protected Route)
 *
 * Form to report a new issue with machine selector.
 * Can be pre-filled with ?machineId=xxx from machine pages.
 */
export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ machineId?: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Get search params (Next.js 16: searchParams is a Promise)
  const params = await searchParams;
  const prefilledMachineId = params.machineId;

  // Fetch all machines for dropdown
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machines.name),
    columns: {
      id: true,
      name: true,
    },
  });

  return (
    <main className="min-h-screen bg-surface py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="border-outline-variant bg-surface shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Plus className="size-8 text-primary" strokeWidth={2.5} />
              <CardTitle className="text-3xl font-bold text-on-surface">
                Report Issue
              </CardTitle>
            </div>
            <p className="text-sm text-on-surface-variant">
              Report a new issue with a pinball machine
            </p>
          </CardHeader>

          <CardContent>
            <CreateIssueForm
              machines={allMachines}
              {...(prefilledMachineId && { prefilledMachineId })}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
