import "server-only";

import { getCollectionForLayout } from "~/app/(app)/c/[id]/_data";
import { getTagForLayout } from "~/app/(app)/c/tags/[type]/[slug]/_data";
import type { IssueExportScope } from "./export-schema";

/**
 * The machine initials in an Issues tab's scope (issues-list §2.2, §5.4),
 * resolved through the same loaders, and so the same access checks, the tab
 * itself uses: a standard Collection opens by id only for people who may view
 * it, or by a valid view token for anyone. Null when the Surface does not
 * exist or the viewer cannot see it.
 */
export async function resolveExportScopeInitials(
  scope: IssueExportScope
): Promise<string[] | null> {
  switch (scope.kind) {
    case "collection": {
      const data = await getCollectionForLayout(scope.handle);
      return data ? data.collection.machines.map((m) => m.initials) : null;
    }
    case "tag": {
      const resolved = await getTagForLayout(scope.type, scope.slug);
      return resolved ? resolved.tag.machines.map((m) => m.initials) : null;
    }
  }
}
