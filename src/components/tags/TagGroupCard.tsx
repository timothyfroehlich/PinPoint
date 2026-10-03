import type React from "react";
import Link from "next/link";
import { AutomaticBadge } from "~/components/tags/AutomaticBadge";
import { ExclusiveBadge } from "~/components/tags/ExclusiveBadge";
import { TagChip } from "~/components/tags/TagChip";
import type { TagGroup } from "~/lib/tags/types";

/** Stable key and heading for one browse group. */
export function tagGroupKey(group: TagGroup): string {
  return group.kind === "untyped" ? "other-tags" : group.type.id;
}

/**
 * One tag type's card in the tag browse (spec 7.3, 7.7–7.8): the type's name
 * linking to its page, its badges, and a chip per tag. Tags with no tag type
 * share an "Other tags" card with no page.
 */
export function TagGroupCard({
  group,
}: {
  group: TagGroup;
}): React.JSX.Element {
  const headingId = `${tagGroupKey(group)}-tags-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-outline-variant bg-card px-3.5 py-3"
    >
      <h2
        id={headingId}
        className="mb-2.5 flex flex-wrap items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {group.kind === "untyped" ? (
          <span className="text-foreground">Other tags</span>
        ) : (
          <Link href={group.type.href} className="text-primary hover:underline">
            {group.kind === "automatic" ? group.type.label : group.type.name}
          </Link>
        )}
        {group.kind === "automatic" ? <AutomaticBadge /> : null}
        {group.kind === "hand" && group.type.exclusive ? (
          <ExclusiveBadge />
        ) : null}
      </h2>
      {group.tags.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No tags yet</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {group.tags.map((tag) => (
            <li key={tag.href} className="max-w-full">
              <TagChip
                href={tag.href}
                name={tag.name}
                machineCount={tag.machines.length}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
