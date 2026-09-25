import type React from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import type { TagTypeInfo } from "~/lib/tags/types";

interface TagTrailProps {
  /** The tag type to link after "Tags"; omit on the tag type's own page. */
  type?: TagTypeInfo;
}

/** "Tags / Manufacturer" above a tag or tag type title (spec 7.7). */
export function TagTrail({ type }: TagTrailProps): React.JSX.Element {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Tag aria-hidden="true" className="size-3.5" />
      <Link href="/c/tags" className="hover:text-foreground">
        Tags
      </Link>
      {type ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={type.href} className="hover:text-foreground">
            {type.label}
          </Link>
        </>
      ) : null}
    </nav>
  );
}
