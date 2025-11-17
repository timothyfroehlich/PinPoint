import type React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Navigation } from "~/components/layout/navigation";
import { publicReportIssueAction } from "./actions";

/**
 * Public Report Issue Page (Unauthenticated)
 *
 * Allows anonymous users to report issues without logging in.
 * Optional name field for attribution.
 */
export default async function PublicReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.JSX.Element> {
  // No auth guard - this is intentionally public

  // Get search params for error display
  const params = await searchParams;
  const errorMessage = params.error;

  // Fetch all machines for dropdown
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machines.name),
    columns: {
      id: true,
      name: true,
    },
  });

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-surface py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-outline-variant bg-surface shadow-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <Plus className="size-8 text-primary" strokeWidth={2.5} />
                <CardTitle className="text-3xl font-bold text-on-surface">
                  Report an Issue with a Pinball Machine
                </CardTitle>
              </div>
              <p className="text-sm text-on-surface-variant">
                Help us keep our machines running smoothly! Report any issues
                you encounter with our pinball machines. No account required.
              </p>
            </CardHeader>

            <CardContent>
              {/* Error message */}
              {errorMessage && (
                <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {decodeURIComponent(errorMessage)}
                </div>
              )}

              {/* Public Report Form */}
              <form action={publicReportIssueAction} className="space-y-6">
                {/* Optional Reporter Name */}
                <div className="space-y-2">
                  <Label htmlFor="reporterName" className="text-on-surface">
                    Your Name (optional)
                  </Label>
                  <Input
                    id="reporterName"
                    name="reporterName"
                    type="text"
                    maxLength={100}
                    placeholder="Leave blank to report anonymously"
                    className="border-outline-variant bg-surface text-on-surface"
                  />
                  <p className="text-xs text-on-surface-variant">
                    Optional: Let us know who reported this issue
                  </p>
                </div>

                {/* Machine Selector */}
                <div className="space-y-2">
                  <Label htmlFor="machineId" className="text-on-surface">
                    Machine *
                  </Label>
                  <select
                    id="machineId"
                    name="machineId"
                    defaultValue={allMachines[0]?.id ?? ""}
                    required
                    className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                  >
                    {!allMachines.length && (
                      <option value="" disabled>
                        No machines available
                      </option>
                    )}
                    {allMachines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-on-surface-variant">
                    Which machine has the issue?
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
                    Description (optional)
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
                  <select
                    id="severity"
                    name="severity"
                    defaultValue="playable"
                    required
                    className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                  >
                    <option value="minor">Minor (cosmetic)</option>
                    <option value="playable">
                      Playable (but needs attention)
                    </option>
                    <option value="unplayable">
                      Unplayable (machine is down)
                    </option>
                  </select>
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
                    Submit Issue Report
                  </Button>
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    className="border-outline-variant text-on-surface"
                  >
                    <Link href="/">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
