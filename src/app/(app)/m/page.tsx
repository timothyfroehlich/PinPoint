import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { MachineView } from "~/components/machines/view";
import { PageContainer } from "~/components/layout/PageContainer";
import { PageHeader } from "~/components/layout/PageHeader";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { getViewer } from "~/lib/collections/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { loadMachineView } from "~/lib/machines/view/queries";
import { loadLineupData } from "~/lib/pinballmap/lineup-data";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { loadMachineViewSurfacePageState } from "./saved-view-surface";

interface MachinesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Public machine directory. The view itself remains public; only the Add
 * Machine action is permission-gated.
 */
export default async function MachinesPage({
  searchParams,
}: MachinesPageProps): Promise<React.JSX.Element> {
  const [viewer, rawSearchParams] = await Promise.all([
    getViewer(),
    searchParams,
  ]);
  const accessLevel = getAccessLevel(viewer.role);
  const canCreateMachine = checkPermission("machines.create", accessLevel);
  // The lineup page's own view gate (lineup spec §2.1–§2.2): the button links
  // only viewers who can open it.
  const canViewLineup = checkPermission(
    "machines.pinballmap.sync",
    accessLevel
  );
  const viewSearchParams = toMachineViewSearchParams(rawSearchParams);
  const { savedViews, redirectTo } = await loadMachineViewSurfacePageState(
    { kind: "machines" },
    viewSearchParams
  );
  if (redirectTo) redirect(redirectTo);
  const result = await loadMachineView({
    scope: { kind: "all" },
    preset: "machines",
    searchParams: viewSearchParams,
  });
  // The difference count comes from the same stored-data comparison the lineup
  // page renders, so the badge can never disagree with the page it links to.
  // It is shown only while configured with a lineup to compare (§2.4–§2.5).
  const lineup = canViewLineup ? (await loadLineupData()).comparison : null;
  const lineupDifferences =
    lineup?.status === "ready" ? lineup.differenceCount : 0;
  const lineupButton = canViewLineup ? (
    <Button asChild variant="outline" data-testid="pinball-map-lineup-button">
      <Link href="/m/pinball-map">
        <MapPin className="mr-2 size-4" aria-hidden="true" />
        Pinball Map
        {lineupDifferences > 0 ? (
          <span
            className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full border border-destructive/50 bg-destructive/10 px-1.5 text-xs font-semibold tabular-nums text-destructive-text"
            data-testid="pinball-map-lineup-differences"
          >
            {lineupDifferences}
            <span className="sr-only">
              {lineupDifferences === 1 ? " difference" : " differences"}
            </span>
          </span>
        ) : null}
      </Link>
    </Button>
  ) : null;
  const addMachineButton = canCreateMachine ? (
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
      <PageHeader
        title="Machines"
        actions={
          lineupButton === null &&
          addMachineButton === undefined ? undefined : (
            <>
              {lineupButton}
              {addMachineButton}
            </>
          )
        }
      />
      {result.scopeCount === 0 ? (
        <EmptyState
          icon={Plus}
          title="No machines yet"
          description={
            canCreateMachine
              ? "Get started by adding your first machine to the collection."
              : "No machines have been added to the collection yet."
          }
          action={
            canCreateMachine ? (
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
      ) : (
        <MachineView
          result={result}
          preset="machines"
          savedViews={savedViews}
        />
      )}
    </PageContainer>
  );
}
