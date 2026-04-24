import type React from "react";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { machines as machinesTable, userProfiles } from "~/server/db/schema";
import { getUnifiedUsers } from "~/lib/users/queries";
import { desc, eq } from "drizzle-orm";
import {
  deriveMachineStatus,
  type IssueForStatus,
} from "~/lib/machines/status";
import { isOnTheFloor } from "~/lib/machines/presence";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Plus, SearchX } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils";
import { MachineStatusBadge } from "~/components/machines/MachineStatusBadge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
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
import { formatDate } from "~/lib/dates";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";

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

  const addMachineButton =
    accessLevel === "admin" || accessLevel === "technician" ? (
      <Button
        asChild
        className="bg-primary text-on-primary hover:bg-primary/90"
        data-testid="add-machine-button"
      >
        <Link href="/m/new">
          <Plus className="mr-2 size-4" />
          Add Machine
        </Link>
      </Button>
    ) : undefined;

  return (
    <PageContainer size="wide">
      <PageHeader title="Machines" actions={addMachineButton} />

      <MachineFilters users={allUsers} filters={filters} />

      {/* Content */}
      <div>
        {sortedMachines.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No matches found"
              description="Try adjusting your filters to find what you're looking for."
              action={
                <Button variant="outline" asChild>
                  <Link href="/m">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Plus}
              title="No machines yet"
              description={
                accessLevel === "admin" || accessLevel === "technician"
                  ? "Get started by adding your first machine to the collection."
                  : "No machines have been added to the collection yet."
              }
              action={
                accessLevel === "admin" || accessLevel === "technician" ? (
                  <Button
                    asChild
                    className="bg-primary text-on-primary hover:bg-primary/90"
                  >
                    <Link href="/m/new">
                      <Plus className="mr-2 size-4" />
                      Add Your First Machine
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          // Machine grid (responsive: 1 col on mobile, 2 on tablet, 3 on desktop)
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMachines.map((machine) => (
              <Link
                key={machine.id}
                data-testid="machine-card"
                href={`/m/${machine.initials}`}
              >
                <Card className="h-full border-outline-variant hover:border-primary/50 hover:glow-primary transition-[color,background-color,border-color,box-shadow] duration-150 cursor-pointer bg-card group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors duration-150">
                        {machine.name}
                      </CardTitle>
                      <div className="flex flex-col items-end gap-1.5">
                        <MachineStatusBadge
                          data-testid="machine-status-badge"
                          status={machine.status}
                          size="sm"
                        />
                        {!isOnTheFloor(machine.presenceStatus) && (
                          <MachinePresenceBadge
                            status={machine.presenceStatus}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Issue count */}
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="text-muted-foreground"
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
                                : "text-muted-foreground"
                          )}
                          data-testid={`machine-open-issues-count-${machine.id}`}
                        >
                          {machine.openIssuesCount}
                        </span>
                      </div>

                      <div className="h-px bg-outline-variant w-full" />

                      {/* Created date */}
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>
                          initials:{" "}
                          <span className="font-mono text-foreground">
                            {machine.initials}
                          </span>
                        </span>
                        <span>Added {formatDate(machine.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
