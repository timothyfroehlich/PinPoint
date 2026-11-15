import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { AddTagDialog } from "~/components/tags/AddTagDialog";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { ExclusiveBadge } from "~/components/tags/ExclusiveBadge";
import { TagList } from "~/components/tags/TagList";
import { TagTrail } from "~/components/tags/TagTrail";
import { TagTypeActionsMenu } from "~/components/tags/TagTypeActionsMenu";
import { getViewer } from "~/lib/auth/viewer";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { exclusiveConflicts } from "~/lib/tags/conflicts";
import { listTags } from "~/lib/tags/tags";
import type { TagGroup } from "~/lib/tags/types";
import { db } from "~/server/db";

interface PageProps {
  params: Promise<{ type: string }>;
}

type TypeGroup = Extract<TagGroup, { kind: "automatic" | "hand" }>;

/**
 * The tag type at `/c/tags/<segment>`: an automatic type by its id, else a
 * hand-applied type by its slug (spec 7.7). Tags with no tag type have no page.
 */
async function findTypeGroup(segment: string): Promise<TypeGroup | null> {
  const groups = await listTags();
  for (const group of groups) {
    if (group.kind === "automatic" && group.type.id === segment) return group;
  }
  for (const group of groups) {
    if (group.kind === "hand" && group.type.slug === segment) return group;
  }
  return null;
}

function typeLabel(group: TypeGroup): string {
  return group.kind === "automatic" ? group.type.label : group.type.name;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { type } = await params;
  const group = await findTypeGroup(type);
  return {
    title: group ? `${typeLabel(group)} Tags | PinPoint` : "Tags | PinPoint",
  };
}

/** A tag type's page (spec collections-and-tags 7.7–7.8, 11.12). */
export default async function TagTypePage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { type } = await params;
  const group = await findTypeGroup(type);
  if (!group) notFound();

  const viewer = await getViewer();
  // Only hand-applied types are managed; automatic ones follow machine data.
  const managed =
    group.kind === "hand" &&
    checkPermission("tags.manage", getAccessLevel(viewer.role))
      ? group
      : null;
  // Opens the one-per-machine dialog already knowing what blocks it (11.7).
  const conflicts =
    managed && !managed.type.exclusive
      ? await exclusiveConflicts(db, managed.type.id)
      : [];

  return (
    <PageContainer size="standard">
      <div className="space-y-6">
        <div className="space-y-1">
          <TagTrail />
          {/* Wraps rather than squeezing at 320px: title, badge, actions. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-outline-variant pb-2">
            <h1 className="text-balance text-3xl font-bold tracking-tight">
              {typeLabel(group)}
            </h1>
            {group.kind === "automatic" ? (
              <AutomaticBadge />
            ) : group.type.exclusive ? (
              <ExclusiveBadge />
            ) : null}
            {managed ? (
              <div className="ml-auto flex items-center gap-2">
                <AddTagDialog
                  type={{ id: managed.type.id, name: managed.type.name }}
                />
                <TagTypeActionsMenu
                  tagTypeId={managed.type.id}
                  name={managed.type.name}
                  tagCount={managed.tags.length}
                  exclusive={managed.type.exclusive}
                  exclusiveConflicts={conflicts}
                />
              </div>
            ) : null}
          </div>
          {group.kind === "automatic" ? (
            <p className="pt-1 text-sm text-muted-foreground">
              {group.type.source}
            </p>
          ) : null}
        </div>
        {group.tags.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tags yet
          </p>
        ) : (
          <TagList
            tags={group.tags.map((tag) => ({
              href: tag.href,
              name: tag.name,
              machineCount: tag.machineCount,
            }))}
          />
        )}
      </div>
    </PageContainer>
  );
}
