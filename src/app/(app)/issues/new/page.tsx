import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
import { createIssueAction } from "../actions";
import { readFlash } from "~/lib/flash";

/**
 * Report New Issue Page (Protected Route)
 *
 * Form for creating new issues.
 * Supports machineId query param to pre-select a machine.
 */
export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ machineId?: string }>;
}): Promise<React.JSX.Element> {
  // Auth guard (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  // Await searchParams (Next.js 15+ requirement)
  const params = await searchParams;
  const preselectedMachineId = params.machineId;

  // Query all machines for the dropdown
  const machines = await db.query.machines.findMany({
    columns: {
      id: true,
      name: true,
    },
    orderBy: (machines, { asc }) => [asc(machines.name)],
  });

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/issues">
              <Button
                variant="outline"
                size="sm"
                className="border-outline text-on-surface hover:bg-surface-variant"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Plus className="size-8 text-primary" strokeWidth={2.5} />
              <div>
                <h1 className="text-3xl font-bold text-on-surface">
                  Report Issue
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">
                  Report a new issue with a pinball machine
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Flash message */}
          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                flash.type === "error"
                  ? "bg-error-container text-on-error-container"
                  : "bg-primary-container text-on-primary-container"
              }`}
              role="alert"
            >
              {flash.message}
            </div>
          )}

          {/* Form Card */}
          <Card className="border-outline-variant">
            <CardHeader>
              <CardTitle className="text-2xl text-on-surface">
                Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createIssueAction} className="space-y-6">
                {/* Machine Selection */}
                <div className="space-y-2">
                  <Label htmlFor="machineId" className="text-on-surface">
                    Machine *
                  </Label>
                  <Select
                    name="machineId"
                    {...(preselectedMachineId && {
                      defaultValue: preselectedMachineId,
                    })}
                    required
                  >
                    <SelectTrigger id="machineId" className="w-full">
                      <SelectValue placeholder="Select a machine..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-on-surface-variant">
                    Which machine has the issue?
                  </p>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-on-surface">
                    Title *
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    placeholder="Brief description of the issue"
                    className="w-full"
                  />
                  <p className="text-xs text-on-surface-variant">
                    Keep it short and descriptive
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-on-surface">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={5}
                    placeholder="Detailed description of the issue (optional)"
                    className="w-full"
                  />
                  <p className="text-xs text-on-surface-variant">
                    Provide additional context or details
                  </p>
                </div>

                {/* Severity */}
                <div className="space-y-2">
                  <Label htmlFor="severity" className="text-on-surface">
                    Severity *
                  </Label>
                  <Select name="severity" defaultValue="playable" required>
                    <SelectTrigger id="severity" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minor">
                        <div>
                          <div className="font-medium">Minor</div>
                          <div className="text-xs text-on-surface-variant">
                            Cosmetic or very minor issue
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="playable">
                        <div>
                          <div className="font-medium">Playable</div>
                          <div className="text-xs text-on-surface-variant">
                            Affects gameplay but still playable
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="unplayable">
                        <div>
                          <div className="font-medium">Unplayable</div>
                          <div className="text-xs text-on-surface-variant">
                            Machine cannot be played
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-on-surface-variant">
                    How severe is this issue?
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <Link href="/issues" className="flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-outline text-on-surface hover:bg-surface-variant"
                    >
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
                  >
                    <Plus className="mr-2 size-4" />
                    Report Issue
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
