import type React from "react";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { submitPublicIssueAction } from "./actions";

// Avoid SSG hitting Supabase during builds that run parallel to db resets
export const dynamic = "force-dynamic";

export default async function PublicReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<React.JSX.Element> {
  const machinesList = await db.query.machines.findMany({
    orderBy: asc(machines.name),
    columns: { id: true, name: true },
  });
  const params = await searchParams;
  const errorMessage = params.error
    ? decodeURIComponent(params.error)
    : undefined;
  const firstMachineId = machinesList[0]?.id ?? "";
  const hasMachines = machinesList.length > 0;

  return (
    <main className="min-h-screen bg-background py-12">
      <div className="container mx-auto max-w-2xl px-4">
        <Card className="shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl font-bold text-foreground">
              Report an Issue with a Pinball Machine
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              No account needed. Tell us what&apos;s going on and the
              maintenance crew will take it from here.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            ) : null}
            {!hasMachines ? (
              <p className="text-muted-foreground">
                Machines have not been added yet. Please try again soon.
              </p>
            ) : null}
            <form action={submitPublicIssueAction} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="machineId" className="text-foreground">
                  Machine *
                </Label>
                <select
                  id="machineId"
                  name="machineId"
                  required
                  defaultValue={firstMachineId}
                  disabled={!hasMachines}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {hasMachines ? (
                    machinesList.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No machines available</option>
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose the machine that needs attention.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">
                  Issue Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g., Left flipper not responding"
                  className="border-input bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Tell us what happened, and how often it occurs."
                  className="border-input bg-background text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Optional details help the repair team reproduce the issue.
                </p>
              </div>

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
                  <option value="minor">Minor (cosmetic)</option>
                  <option value="playable">
                    Playable (but needs attention)
                  </option>
                  <option value="unplayable">
                    Unplayable (machine is down)
                  </option>
                </select>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-on-primary hover:bg-primary/90"
                disabled={!hasMachines}
              >
                Submit Issue Report
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Prefer a full member account?{" "}
                <Link
                  href="/signup"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Sign up here
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
