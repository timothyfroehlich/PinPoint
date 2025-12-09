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
import { Lock, QrCode, RefreshCw } from "lucide-react";
import { submitPublicIssueAction } from "./actions";
import { MainLayout } from "~/components/layout/MainLayout";
import { resolveDefaultMachineId } from "./default-machine";

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
  const source = params.source;
  const hasMachines = machinesList.length > 0;
  const defaultMachineId = resolveDefaultMachineId(
    machinesList,
    machineIdFromQuery,
    machineInitialsFromQuery
  );
  const defaultMachineName =
    machinesList.find((machine) => machine.id === defaultMachineId)?.name ??
    undefined;

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
              {source ? (
                <input type="hidden" name="source" value={source} />
              ) : null}
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
                {source === "qr" && defaultMachineName ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-on-surface">
                            {defaultMachineName}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-primary">
                            <QrCode className="h-3 w-3" />
                            <span>Verified from QR Scan</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface"
                        onClick={() => {
                          // This is a server component, so we can't efficiently toggle state without client logic.
                          // But we can just link to /report to clear params, effectively "unlocking" it.
                          // However, since we are in a Transition, standard navigation is best.
                          window.location.href = "/report";
                        }}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Change
                      </Button>
                    </div>
                    {/* Hidden input to ensure value is submitted even when select is hidden/disabled */}
                    <input
                      type="hidden"
                      name="machineId"
                      value={defaultMachineId}
                    />
                  </div>
                ) : (
                  <>
                    <select
                      id="machineId"
                      name="machineId"
                      required
                      defaultValue={defaultMachineId}
                      disabled={!hasMachines}
                      data-testid="machine-select"
                      className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
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
                    <p className="text-xs text-on-surface-variant">
                      Choose the machine that needs attention.
                    </p>
                  </>
                )}
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
