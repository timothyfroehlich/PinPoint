import type React from "react";
import { notFound, redirect } from "next/navigation";
import { MachineView } from "~/components/machines/view";
import { EditTagMachinesDialog } from "~/components/tags/EditTagMachinesDialog";
import { loadMachineView } from "~/lib/machines/view/queries";
import { toMachineViewSearchParams } from "~/lib/machines/view/state";
import { loadMachineViewSavedViews } from "~/lib/machines/view/saved-views";
import {
  canonicalTagPath,
  getTagEditor,
  getTagForLayout,
} from "~/app/(app)/c/tags/[type]/[slug]/_data";

interface PageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TagOverviewPage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const [{ type, slug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const resolved = await getTagForLayout(type, slug);
  if (!resolved) notFound();
  const canonical = canonicalTagPath(
    resolved,
    { type, slug },
    "",
    rawSearchParams
  );
  if (canonical !== null) redirect(canonical);
  const { tag } = resolved;

  // A hand-applied tag can have no machines; its page stays open and says so
  // (spec 11.13). Automatic tags only exist while a machine carries them.
  // Removed machines do not count, as on the browse (spec 7.9).
  if (tag.kind === "hand" && tag.machineCount === 0) {
    const editor = await getTagEditor(type, slug);
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-outline-variant bg-card px-6 py-12 text-center">
        <p className="text-base font-semibold text-foreground">No machines</p>
        {editor ? <EditTagMachinesDialog {...editor} variant="add" /> : null}
      </div>
    );
  }

  const viewSearchParams = toMachineViewSearchParams(rawSearchParams);
  const [{ savedViews }, result] = await Promise.all([
    loadMachineViewSavedViews("collection", viewSearchParams),
    loadMachineView({
      scope:
        tag.kind === "hand"
          ? { kind: "handTag", tagId: tag.id }
          : { kind: "tag", tagType: tag.type, slug: tag.slug },
      preset: "collection",
      searchParams: viewSearchParams,
    }),
  ]);
  return (
    <MachineView result={result} preset="collection" savedViews={savedViews} />
  );
}
