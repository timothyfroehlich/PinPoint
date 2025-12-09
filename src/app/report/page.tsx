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
import { MainLayout } from "~/components/layout/MainLayout";

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
  const hasMachines = machinesList.length > 0;

  return (
    <MainLayout>
      <div className="container mx-auto max-w-2xl py-8">
        <Card className="border-outline-variant bg-surface shadow-lg">
          <CardHeader className="space-y-3">
            <CardTitle className="text-3xl font-bold text-on-surface">
              Report an Issue with a Pinball Machine
            </CardTitle>
            <p className="text-sm text-on-surface-variant">
              No account needed. Tell us what&apos;s going on and the
              maintenance crew will take it from here.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-300"
              >
                {errorMessage}
              </div>
            ) : null}
            {!hasMachines ? (
              <p className="text-on-surface-variant">
                Machines have not been added yet. Please try again soon.
              </p>
            ) : null}
            <form action={submitPublicIssueAction} className="space-y-5">
              {/* Honeypot field - hidden from humans, filled by bots */}
              <input
                type="text"
                name="website"
                className="sr-only"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              <div className="space-y-2">
                <Label htmlFor="machineId" className="text-on-surface">
                  Machine *
                </Label>
                <select
                  id="machineId"
                  name="machineId"
                  required
                  defaultValue=""
                  disabled={!hasMachines}
                  data-testid="machine-select"
                  className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                >
                  <option value="" disabled>
                    Select a machine...
                  </option>
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
                <p className="text-xs text-on-surface-variant">
                  Choose the machine that needs attention.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-on-surface">
                  Issue Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="e.g., Left flipper not responding"
                  className="border-outline-variant bg-surface text-on-surface"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-on-surface">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  placeholder="Tell us what happened, and how often it occurs."
                  className="border-outline-variant bg-surface text-on-surface"
                />
                <p className="text-xs text-on-surface-variant">
                  Optional details help the repair team reproduce the issue.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity" className="text-on-surface">
                  Severity *
                </Label>
                <select
                  id="severity"
                  name="severity"
                  defaultValue=""
                  required
                  className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                >
                  <option value="" disabled>
                    Select severity...
                  </option>
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
              <p className="text-center text-xs text-on-surface-variant">
                Prefer a full member account?{" "}
                <Link
                  href="/signup"
                  className="text-primary text-link underline-offset-2"
                >
                  Sign up here
                </Link>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
