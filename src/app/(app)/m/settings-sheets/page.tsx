import type React from "react";
import type { Metadata } from "next";

import { PageContainer } from "~/components/layout/PageContainer";
import { SettingsSheetsBuilder } from "~/components/machines/settings/SettingsSheetsBuilder";
import { db } from "~/server/db";
import {
  getOnTheFloorMachineIds,
  getPrintRunMachines,
  getSettingsTagOptions,
} from "~/lib/machines/settings-sheet-queries";
import {
  parsePrintRunQuery,
  printRunRowsFromQuery,
} from "~/lib/machines/settings-sheet-run";
import { loadMachineView } from "~/lib/machines/view/queries";
import { loadMachineViewSavedViews } from "~/lib/machines/view/saved-views";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";

export const metadata: Metadata = { title: "Print settings sheets" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Print settings sheets (settings-sheets §2): add machines from the Machines
 * list, adjust each one's From and To sets, and print. Open to everyone,
 * anonymous visitors included (§2.1). A Collection or tag page, or the print
 * page's way back, names a run in the URL (`m`, §2.6, §2.8).
 */
export default async function PrintSettingsSheetsPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const rawSearchParams = await searchParams;
  const viewSearchParams = toMachineViewSearchParams(rawSearchParams);
  const query = parsePrintRunQuery(rawSearchParams);
  const [loadedViews, result, onFloor, tags, initialMachines] =
    await Promise.all([
      loadMachineViewSavedViews("machines", viewSearchParams),
      loadMachineView({
        scope: { kind: "all" },
        preset: "machines",
        searchParams: viewSearchParams,
        withMatchingIds: true,
      }),
      getOnTheFloorMachineIds(db),
      getSettingsTagOptions(db),
      getPrintRunMachines(db, { kind: "initials", initials: query.initials }),
    ]);
  // The account's Default View belongs to the Machines page (list-views
  // §10.10); this page opens at its Page Preset and never sets a default.
  const savedViews = {
    ...loadedViews.savedViews,
    offersDefault: false,
    activeViewId:
      loadedViews.redirectTo === null
        ? loadedViews.savedViews.activeViewId
        : null,
  };
  // The ids reach the client only as `addableIds`.
  const { matchingIds = [], ...listResult } = result;
  const initialRun =
    query.initials.length === 0
      ? null
      : {
          options: query.options,
          rows: printRunRowsFromQuery(query, initialMachines),
        };

  return (
    <PageContainer size="wide">
      <SettingsSheetsBuilder
        result={listResult}
        savedViews={savedViews}
        addableIds={matchingIds.filter((id) => onFloor.has(id))}
        tags={tags.map(({ slug, name }) => ({ slug, name }))}
        initialRun={initialRun}
        initialMachines={initialMachines}
      />
    </PageContainer>
  );
}
