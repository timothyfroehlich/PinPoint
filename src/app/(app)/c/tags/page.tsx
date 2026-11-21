import type React from "react";
import type { Metadata } from "next";
import { PageContainer } from "~/components/layout/PageContainer";
import { TagGroupCard, tagGroupKey } from "~/components/tags/TagGroupCard";
import { TagsPageActions } from "~/components/tags/TagsPageActions";
import { getViewer } from "~/lib/auth/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { listTags } from "~/lib/tags/tags";

export const metadata: Metadata = {
  title: "Tags | PinPoint",
};

/**
 * Public tag browse (spec collections-and-tags 7.3, 11.12–11.14): one card per
 * tag type, automatic types first, then hand-applied types by name, then the
 * tags with no tag type. Technicians and admins create tag types and tags here.
 * Settings tags, which label settings sets rather than machines, have their
 * own page (machine-settings §3.7).
 */
export default async function TagsPage(): Promise<React.JSX.Element> {
  const [groups, viewer] = await Promise.all([listTags(), getViewer()]);
  const canManage = checkPermission("tags.manage", getAccessLevel(viewer.role));
  // Automatic types and "Other tags" exist only while they have tags; a
  // hand-applied type is listed even when empty.
  const shown = groups.filter(
    (group) => group.kind === "hand" || group.tags.length > 0
  );
  const handTypes = groups.flatMap((group) =>
    group.kind === "hand" ? [{ id: group.type.id, name: group.type.name }] : []
  );

  return (
    <PageContainer size="standard" className="max-w-4xl">
      <div className="space-y-6">
        <div className="flex min-h-11 items-center gap-3 border-b border-outline-variant pb-2">
          <h1 className="shrink-0 text-balance text-3xl font-bold tracking-tight">
            Tags
          </h1>
          <TagsPageActions manage={canManage ? { types: handTypes } : null} />
        </div>
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {shown.map((group) => (
              <TagGroupCard key={tagGroupKey(group)} group={group} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
