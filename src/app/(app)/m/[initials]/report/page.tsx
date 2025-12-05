import type React from "react";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { CreateIssueForm } from "./create-issue-form";

/**
 * Report New Issue Page (Protected Route)
 *
 * Form to report a new issue for a specific machine.
 */
export default async function NewIssuePage({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // Get params (Next.js 16: params is a Promise)
  const { initials } = await params;

  // Fetch machine
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    columns: {
      name: true,
      initials: true,
    },
  });

  if (!machine) {
    notFound();
  }

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
              Report a new issue for {machine.name}
            </p>
          </CardHeader>

          <CardContent>
            <CreateIssueForm
              machineInitials={machine.initials}
              machineName={machine.name}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
