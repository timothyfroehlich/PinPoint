"use client";

import type React from "react";

import { RelativeTime } from "~/components/issues/RelativeTime";

/**
 * A timeline row's right-pinned relative time: "3m ago" on rows narrower than
 * 320px, "3 minutes ago" from there up. Rows that narrow only occur on phones
 * (a 320px or 375px viewport), where the long label left no room for the
 * row's own text (PP-xw8s). Needs an `@container` ancestor — the row body.
 */
export function TimelineRowTime({ value }: { value: Date }): React.JSX.Element {
  return (
    <>
      <span className="@[320px]:hidden">
        <RelativeTime value={value} format="compact" />
      </span>
      <span className="hidden @[320px]:inline">
        <RelativeTime value={value} />
      </span>
    </>
  );
}
