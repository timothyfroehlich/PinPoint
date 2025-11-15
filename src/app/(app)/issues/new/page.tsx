import type React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
                <Label htmlFor="machineId" className="text-on-surface">
                  Machine *
                </Label>
                <Select
                  name="machineId"
                  {...(prefilledMachineId && {
                    defaultValue: prefilledMachineId,
                  })}
                  required
                >
                  <SelectTrigger className="border-outline-variant bg-surface text-on-surface">
                    <SelectValue placeholder="Select a machine" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMachines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-on-surface-variant">
                  Select the machine with the issue
                </p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-on-surface">
                  Issue Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Brief description of the issue"
                  className="border-outline-variant bg-surface text-on-surface"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-on-surface">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Additional details about the issue (optional)"
                  className="border-outline-variant bg-surface text-on-surface"
                />
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity" className="text-on-surface">
                  Severity *
                </Label>
                <Select name="severity" defaultValue="playable" required>
                  <SelectTrigger className="border-outline-variant bg-surface text-on-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">
                      Minor (cosmetic, doesn&apos;t affect gameplay)
                    </SelectItem>
                    <SelectItem value="playable">
                      Playable (affects gameplay but machine is playable)
                    </SelectItem>
                    <SelectItem value="unplayable">
                      Unplayable (machine cannot be played)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-on-surface-variant">
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
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.history.back();
                  }}
                  className="border-outline-variant text-on-surface"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
