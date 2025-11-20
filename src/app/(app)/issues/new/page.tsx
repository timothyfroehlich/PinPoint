import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { desc } from "drizzle-orm";
import { readFlash } from "~/lib/flash";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { createIssueAction } from "../actions";

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

  if (!user) {
    redirect("/login");
  }

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

  // Read flash message
  const flash = await readFlash();

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <Plus className="size-8 text-primary" strokeWidth={2.5} />
              <CardTitle className="text-3xl font-bold text-foreground">
                Report Issue
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Report a new issue with a pinball machine
            </p>
          </CardHeader>

          <CardContent>
            {/* Flash message */}
            {flash && (
              <div
                className={`mb-6 rounded-md border px-4 py-3 text-sm ${
                  flash.type === "error"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-green-300 bg-green-50 text-green-800"
                }`}
              >
                {flash.message}
              </div>
            )}

            {/* Create Issue Form */}
            <form action={createIssueAction} className="space-y-6">
              {/* Machine Selector */}
              <div className="space-y-2">
                <Label htmlFor="machineId" className="text-foreground">
                  Machine *
                </Label>
                <select
                  id="machineId"
                  name="machineId"
                  defaultValue={prefilledMachineId ?? allMachines[0]?.id ?? ""}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {prefilledMachineId == null && !allMachines.length && (
                    <option value="" disabled>
                      Select a machine
                    </option>
                  )}
                  {allMachines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Select the machine with the issue
                </p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">
                  Issue Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Brief description of the issue"
                  className="border-input bg-background text-foreground"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Additional details about the issue (optional)"
                  className="border-input bg-background text-foreground"
                />
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity" className="text-foreground">
                  Severity *
                </Label>
                <select
                  id="severity"
                  name="severity"
                  defaultValue="playable"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="minor">
                    Minor (cosmetic, doesn&apos;t affect gameplay)
                  </option>
                  <option value="playable">
                    Playable (affects gameplay but machine is playable)
                  </option>
                  <option value="unplayable">
                    Unplayable (machine cannot be played)
                  </option>
                </select>
                <p className="text-xs text-muted-foreground">
                  How severely does this issue affect the machine?
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
                >
                  Report Issue
                </Button>
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="border-input text-foreground"
                >
                  <Link href="/issues">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
