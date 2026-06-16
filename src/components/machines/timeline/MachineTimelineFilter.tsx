"use client";

import type React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MultiSelect, type Option } from "~/components/ui/multi-select";
import {
  TIMELINE_TAGS,
  getTagLabel,
  tagSchema,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";
import {
  TAG_DECORATION,
  tagTextColor,
} from "~/lib/timeline/user-tag-decoration";

interface Props {
  currentTags: TimelineTag[];
  /**
   * Target path for filter pushes. Defaults to the current pathname (the
   * per-machine timeline). Collection feeds pass their own route so the
   * component isn't tied to `/m/[initials]/timeline` (PP-slrd.1).
   */
  baseUrl?: string;
}

/**
 * Tag filter — the app's shared {@link MultiSelect} (Popover + Command +
 * visible checkboxes + count badge + search), the same control the issue
 * list uses. Visible checkboxes make the multi-select nature obvious.
 *
 * "All" is the empty selection, not a row: no tags selected = no `?tag=`
 * param = everything shown. Each option carries its tag icon + color so the
 * dropdown matches the composer/edit pickers and the row badges.
 *
 * URL: `?tag=` missing = all; `?tag=maintenance,upgrade` = explicit subset.
 */
const TAG_OPTIONS: Option[] = TIMELINE_TAGS.map((t) => {
  const { Icon, badgeClass } = TAG_DECORATION[t];
  const iconColor = tagTextColor(badgeClass);
  return {
    label: getTagLabel(t),
    value: t,
    icon: Icon,
    ...(iconColor !== undefined ? { iconColor } : {}),
  };
});

export function MachineTimelineFilter({
  currentTags,
  baseUrl,
}: Props): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const writeTags = (next: TimelineTag[]): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) {
      params.delete("tag");
    } else {
      params.set("tag", next.join(","));
    }
    // Reset to page 1 on any filter change — keeping a deep `?page=` from the
    // previous filter would land on an empty/stale page (PP-ii3u #5).
    params.delete("page");
    const qs = params.toString();
    const target = baseUrl ?? pathname;
    router.push(qs ? `${target}?${qs}` : target);
  };

  const handleChange = (next: string[]): void => {
    // Values originate from TAG_OPTIONS (all valid), but validate at this
    // boundary rather than blind-cast — the enum is the source of truth.
    const tags = next.flatMap((s) => {
      const parsed = tagSchema.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
    writeTags(tags);
  };

  return (
    <MultiSelect
      options={TAG_OPTIONS}
      value={currentTags}
      onChange={handleChange}
      placeholder="Tags"
      searchPlaceholder="Filter tags…"
      ariaLabel="Filter by tag"
      data-testid="timeline-tag-filter"
      className="w-44"
    />
  );
}
