import type React from "react";
import Link from "next/link";

interface TagListProps {
  tags: { href: string; name: string; machineCount: number }[];
}

/** One tag type's tags with machine counts, as on My Collections. */
export function TagList({ tags }: TagListProps): React.JSX.Element {
  return (
    <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
      {tags.map((tag) => (
        <li key={tag.href}>
          <Link
            href={tag.href}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
          >
            <span className="font-medium text-foreground">{tag.name}</span>
            <span className="text-sm text-muted-foreground">
              {tag.machineCount}{" "}
              {tag.machineCount === 1 ? "machine" : "machines"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
