import type React from "react";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines as machinesTable, userProfiles } from "~/server/db/schema";
import { getUnifiedUsers } from "~/lib/users/queries";
import { desc, eq } from "drizzle-orm";
import {
  deriveMachineStatus,
  getMachineStatusLabel,
  getMachineStatusStyles,
  type IssueForStatus,
} from "~/lib/machines/status";
import {
  getMachinePresenceLabel,
  getMachinePresenceStyles,
  isOnTheFloor,
} from "~/lib/machines/presence";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Plus, SearchX } from "lucide-react";
import { cn } from "~/lib/utils";
import {
  parseMachineFilters,
  hasActiveMachineFilters,
} from "~/lib/machines/filters";
import {
  applyMachineFilters,
  sortMachines,
} from "~/lib/machines/filters-queries";
import { MachineFilters } from "~/components/machines/MachineFilters";
import { getAccessLevel } from "~/lib/permissions/helpers";

interface MachinesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Machines List Page (Public Route)
 *
 * Shows all machines with their derived status based on open issues.
 * Status hierarchy: unplayable > needs_service > operational
 *
 * Accessible to all users (unauthenticated, guest, member, admin).
 * The "Add Machine" button is only shown to admins.
 */
export default async function MachinesPage({
  searchParams,
}: MachinesPageProps): Promise<React.JSX.Element> {
  // Get current user if authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine user's access level
  let accessLevel = getAccessLevel(null); // default to "unauthenticated"
  if (user) {
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: {
        role: true,
      },
    });
    accessLevel = getAccessLevel(userProfile?.role);
  }

  // Parse filters from search params
  const rawParams = await searchParams;
  const urlParams = new URLSearchParams();
  Object.entries(rawParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      urlParams.set(key, value.join(","));
    } else if (value) {
      urlParams.set(key, value);
    }
  });

  const filters = parseMachineFilters(urlParams);
  const hasFilters = hasActiveMachineFilters(urlParams);

  // Query machines with their open issues and ownership info
  const allMachines = await db.query.machines.findMany({
    orderBy: desc(machinesTable.name),
    with: {
      issues: {
        columns: {
          status: true,
          severity: true,
        },
      },
      owner: {
        columns: {
          id: true,
          name: true,
        },
      },
      invitedOwner: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
    columns: {
      id: true,
      name: true,
      initials: true,
      presenceStatus: true,
      createdAt: true,
      ownerId: true,
      invitedOwnerId: true,
    },
  });

  // Fetch all users for the owner filter (smart sorted: confirmed first, by machine count)
  // Map to minimal shape — only send what MachineFilters needs to the client
  const allUsers = (await getUnifiedUsers()).map((u) => ({
    id: u.id,
    name: u.name,
    machineCount: u.machineCount,
    status: u.status,
  }));

  // Derive status and prepare for filtering
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
      presenceStatus: machine.presenceStatus,
      openIssuesCount,
      createdAt: machine.createdAt,
      ownerId: machine.ownerId,
      invitedOwnerId: machine.invitedOwnerId,
    };
  });

  // Default: only show "on the floor" machines unless presence filter is explicitly set.
  filters.presence ??= ["on_the_floor"];

  // Apply filters and sorting
  const filteredMachines = applyMachineFilters(machinesWithStatus, filters);
  const sortedMachines = sortMachines(
    filteredMachines,
    filters.sort ?? "name_asc"
  );

  return (
    <main className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-outline-variant bg-surface-container">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-on-surface">Machines</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Manage pinball machines and view their status
                </p>
              </div>
              {accessLevel === "admin" && (
                <Button
                  asChild
                  className="bg-primary text-on-primary hover:bg-primary/90 rounded-full h-11 px-6"
                >
                  <Link href="/m/new">
                    <Plus className="mr-2 size-4" />
                    Add Machine
                  </Link>
                </Button>
              )}
            </div>

            <MachineFilters users={allUsers} filters={filters} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {sortedMachines.length === 0 ? (
          // Empty state
          <Card className="border-outline-variant border-dashed bg-transparent">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                {hasFilters ? (
                  <>
                    <div className="rounded-full bg-surface-container-highest p-4">
                      <SearchX className="size-8 text-on-surface-variant" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-semibold text-on-surface">
                        No matches found
                      </p>
                      <p className="text-on-surface-variant">
                        Try adjusting your filters to find what you're looking
                        for.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-semibold text-on-surface">
                      No machines yet
                    </p>
                    <p className="text-on-surface-variant mb-4">
                      {accessLevel === "admin"
                        ? "Get started by adding your first machine to the collection."
                        : "No machines have been added to the collection yet."}
                    </p>
                    {accessLevel === "admin" && (
                      <Link href="/m/new">
                        <Button className="bg-primary text-on-primary hover:bg-primary/90 rounded-full h-11 px-6">
                          <Plus className="mr-2 size-4" />
                          Add Your First Machine
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          // Machine grid (responsive: 1 col on mobile, 2 on tablet, 3 on desktop)
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMachines.map((machine) => (
              <Link
                key={machine.id}
                data-testid="machine-card"
                href={`/m/${machine.initials}`}
              >
                <Card className="h-full border-outline-variant hover:border-primary transition-all cursor-pointer hover:shadow-md bg-surface-container-low group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl text-on-surface group-hover:text-primary transition-colors">
                        {machine.name}
                      </CardTitle>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge
                          data-testid="machine-status-badge"
                          className={cn(
                            getMachineStatusStyles(machine.status),
                            "border px-2.5 py-0.5 text-xs font-semibold rounded-full"
                          )}
                        >
                          {getMachineStatusLabel(machine.status)}
                        </Badge>
                        {!isOnTheFloor(machine.presenceStatus) && (
                          <Badge
                            className={cn(
                              getMachinePresenceStyles(machine.presenceStatus),
                              "border px-2.5 py-0.5 text-xs font-semibold rounded-full"
                            )}
                          >
                            {getMachinePresenceLabel(machine.presenceStatus)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
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
                            "font-bold",
                            machine.status === "unplayable"
                              ? "text-error"
                              : machine.status === "needs_service"
                                ? "text-warning"
                                : "text-on-surface-variant"
                          )}
                          data-testid={`machine-open-issues-count-${machine.id}`}
                        >
                          {machine.openIssuesCount}
                        </span>
                      </div>

                      <div className="h-px bg-outline-variant w-full" />

                      {/* Created date */}
                      <div className="text-xs text-on-surface-variant flex items-center justify-between">
                        <span>
                          initials:{" "}
                          <span className="font-mono text-on-surface">
                            {machine.initials}
                          </span>
                        </span>
                        <span>
                          Added{" "}
                          {new Date(machine.createdAt).toLocaleDateString()}
                        </span>
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
