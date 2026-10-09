import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "~/components/layout/PageContainer";
import { AddTagDialog } from "~/components/tags/AddTagDialog";
import { AddTagTypeDialog } from "~/components/tags/AddTagTypeDialog";
import { TagGroupCard, tagGroupKey } from "~/components/tags/TagGroupCard";
import { Button } from "~/components/ui/button";
import { SETTINGS_TAGS_HREF } from "~/lib/machines/settings-tags";
import { getViewer } from "~/lib/collections/viewer";
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
        <div className="flex flex-col gap-3 border-b border-outline-variant pb-3 md:flex-row md:items-end md:justify-between md:pb-2">
          <h1 className="text-balance text-3xl font-bold tracking-tight">
            Tags
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-primary max-md:h-11"
            >
              <Link href={SETTINGS_TAGS_HREF}>Settings tags</Link>
            </Button>
            {canManage ? (
              <>
                <AddTagTypeDialog />
                <AddTagDialog types={handTypes} />
              </>
            ) : null}
          </div>
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
