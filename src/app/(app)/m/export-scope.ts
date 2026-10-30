import "server-only";

import { getCollectionForLayout } from "~/app/(app)/c/[id]/_data";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";
import type { MachineViewScope } from "~/lib/types";
import type { MachineExportScope } from "./export-schema";

/**
 * The Machine View scope and preset behind an export's Surface
 * (machine-views §3.15), resolved through the same loaders, and so the same
 * access checks, the tab itself uses: a standard Collection opens by id only
 * for people who may view it, or by a valid view token for anyone. Null when
 * the Surface does not exist or the viewer cannot see it.
 */
export async function resolveMachineExportScope(
  scope: MachineExportScope
): Promise<{
  scope: MachineViewScope;
  preset: "machines" | "collection";
} | null> {
  switch (scope.kind) {
    case "all":
      return { scope: { kind: "all" }, preset: "machines" };
    case "collection": {
      const data = await getCollectionForLayout(scope.handle);
      return data
        ? {
            scope: { kind: "collection", collectionId: data.collection.id },
            preset: "collection",
          }
        : null;
    }
    case "tag": {
      const resolved = await getTagForLayout(scope.type, scope.slug);
      if (!resolved) return null;
      const { tag } = resolved;
      return {
        scope:
          tag.kind === "hand"
            ? { kind: "handTag", tagId: tag.id }
            : { kind: "tag", tagType: tag.type, slug: tag.slug },
        preset: "collection",
      };
    }
  }
}
