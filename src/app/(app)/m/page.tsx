import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { desc } from "drizzle-orm";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
  type IssueForStatus,
} from "~/lib/machines/status";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Machines List Page (Protected Route)
 *
 * Shows all machines with their derived status based on open issues.
 * Status hierarchy: unplayable > needs_service > operational
 */
export default async function MachinesPage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fm");
  }

  // Query machines with their open issues (direct Drizzle query - no DAL)
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machines.name),
    with: {
      issues: {
        columns: {
          status: true,
          severity: true,
        },
      },
    },
    columns: {
      id: true,
      name: true,
      initials: true,
      createdAt: true,
    },
  });

  // Derive status for each machine
  const machinesWithStatus = allMachines.map((machine) => {
    const status = deriveMachineStatus(machine.issues as IssueForStatus[]);
    const openIssuesCount = machine.issues.filter(
      (issue) => !(CLOSED_STATUSES as readonly string[]).includes(issue.status)
    ).length;

    return {
      id: machine.id,
      name: machine.name,
      initials: machine.initials,
      status,
      openIssuesCount,
      createdAt: machine.createdAt,
      issues: machine.issues,
    };
  });

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-on-surface">Machines</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage pinball machines and view their status
              </p>
            </div>
            <Button
              asChild
              className="bg-primary text-on-primary hover:bg-primary/90"
            >
              <Link href="/m/new">
                <Plus className="mr-2 size-4" />
                Add Machine
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {machinesWithStatus.length === 0 ? (
          // Empty state
          <Card className="border-outline-variant">
            <CardContent className="py-12 text-center">
              <p className="text-lg text-on-surface-variant mb-4">
                No machines yet
              </p>
              <Link href="/m/new">
                <Button className="bg-primary text-on-primary hover:bg-primary/90">
                  <Plus className="mr-2 size-4" />
                  Add Your First Machine
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          // Machine grid (responsive: 1 col on mobile, 2 on tablet, 3 on desktop)
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machinesWithStatus.map((machine) => (
              <Link
                key={machine.id}
                data-testid="machine-card"
                href={`/m/${machine.initials}`}
              >
                <Card className="h-full border-outline-variant hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl text-on-surface">
                        {machine.name}
                      </CardTitle>
                      <Badge
                        data-testid="machine-status-badge"
                        className={cn(
                          getMachineStatusStyles(machine.status),
                          "border px-2 py-1 text-xs font-semibold"
                        )}
                      >
                        {getMachineStatusLabel(machine.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Issue count */}
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="text-on-surface-variant"
                          data-testid="machine-open-issues-label"
                        >
                          Open Issues:
                        </span>
                        <span
                          className={cn(
                            "font-semibold",
                            machine.issues.some(
                              (i) =>
                                i.severity === "unplayable" &&
                                !(
                                  CLOSED_STATUSES as readonly string[]
                                ).includes(i.status)
                            )
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                          data-testid={`machine-open-issues-count-${machine.id}`}
                        >
                          {machine.openIssuesCount}
                        </span>
                      </div>

                      {/* Created date */}
                      <div className="text-xs text-on-surface-variant">
                        Added {new Date(machine.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
