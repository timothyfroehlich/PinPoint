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
import { lineupToReviewCount } from "~/lib/pinballmap/lineup-comparison";
import { loadLineupData } from "~/lib/pinballmap/lineup-data";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { loadMachineViewSavedViews } from "~/lib/machines/view/saved-views";

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
  const { savedViews, redirectTo } = await loadMachineViewSavedViews(
    "machines",
    viewSearchParams
  );
  if (redirectTo) redirect(redirectTo);
  const [result, lineupData] = await Promise.all([
    loadMachineView({
      scope: { kind: "all" },
      preset: "machines",
      searchParams: viewSearchParams,
    }),
    canViewLineup ? loadLineupData() : Promise.resolve(null),
  ]);
  // The "to review" count comes from the same stored-data comparison the
  // lineup page renders, so the badge can never disagree with the page it links
  // to (§4.1). It is zero until there is a lineup to compare (§2.4–§2.5).
  const lineupToReview =
    lineupData === null ? 0 : lineupToReviewCount(lineupData.comparison);
  // On phones the actions shrink to icon buttons that keep their accessible
  // names (list-views §7.2).
  const lineupButton = canViewLineup ? (
    <Button
      asChild
      variant="outline"
      className="relative max-md:size-11 max-md:px-0"
      data-testid="pinball-map-lineup-button"
    >
      <Link
        href="/m/pinball-map"
        aria-label={
          lineupToReview > 0
            ? `Pinball Map, ${lineupToReview} to review`
            : "Pinball Map"
        }
      >
        <MapPin className="size-4 md:mr-2" aria-hidden="true" />
        <span className="max-md:hidden">Pinball Map</span>
        {lineupToReview > 0 ? (
          <span
            aria-hidden="true"
            className="inline-flex min-w-5 items-center justify-center rounded-full border border-error-container bg-error-container px-1.5 text-xs font-semibold tabular-nums text-on-error-container max-md:absolute max-md:-top-1.5 max-md:-right-1.5 md:ml-2 md:bg-error-container/50"
            data-testid="pinball-map-lineup-to-review"
          >
            {lineupToReview}
          </span>
        ) : null}
      </Link>
    </Button>
  ) : null;
  const addMachineButton = canCreateMachine ? (
    <Button
      asChild
      className="bg-primary text-on-primary hover:bg-primary/90 max-md:h-11 max-[389px]:w-11 max-[389px]:px-0"
      data-testid="add-machine-button"
    >
      <Link href="/m/new" aria-label="Add Machine">
        <Plus
          className="size-4 min-[390px]:mr-1.5 md:mr-2"
          aria-hidden="true"
        />
        <span className="max-[389px]:hidden">
          Add<span className="max-md:hidden"> Machine</span>
        </span>
      </Link>
    </Button>
  ) : null;
  const pageActions =
    lineupButton === null && addMachineButton === null ? undefined : (
      <>
        {lineupButton}
        {addMachineButton}
      </>
    );

  if (result.scopeCount === 0) {
    return (
      <PageContainer size="wide">
        <PageHeader title="Machines" actions={pageActions} />
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
      </PageContainer>
    );
  }

  // Machine View draws the title row so the phone Summary Row toggle can sit
  // in it (list-views §3.1, §7.2).
  return (
    <PageContainer size="wide" className="max-md:pt-3">
      <MachineView
        result={result}
        preset="machines"
        savedViews={savedViews}
        title="Machines"
        actions={pageActions}
      />
    </PageContainer>
  );
}
