"use client";

import type React from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  TIMELINE_TAGS,
  getTagLabel,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

interface Props {
  currentTags: TimelineTag[];
}

/**
 * Multi-select "sticky All" filter.
 *
 * UI pattern: "All" is the empty-state of the selection, not a sibling. Picking
 * any specific tag clears "All"; checking "All" clears every specific tag;
 * unchecking the last specific tag puts you back at "All" automatically. URL:
 * `?tag=` missing = all, `?tag=maintenance,event` = explicit subset (CSV).
 */
export function MachineTimelineFilter({
  currentTags,
}: Props): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const allSelected = currentTags.length === 0;

  const writeTags = (next: TimelineTag[]): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) {
      params.delete("tag");
    } else {
      params.set("tag", next.join(","));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const toggleAll = (): void => {
    // "All" → empty set (deselect everything specific). Already-all is a no-op
    // because checking it again would be the same state.
    writeTags([]);
  };

  const toggleTag = (tag: TimelineTag): void => {
    const set = new Set(currentTags);
    if (set.has(tag)) {
      set.delete(tag);
    } else {
      set.add(tag);
    }
    // If the user just unchecked the last tag, fall back to "All" (empty set).
    writeTags([...set]);
  };

  const [onlyTag] = currentTags;
  const triggerLabel = allSelected
    ? "All tags"
    : onlyTag && currentTags.length === 1
      ? getTagLabel(onlyTag)
      : `${String(currentTags.length)} tags`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Filter by tag"
          className="w-44 justify-between"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onSelect={(e) => {
            // Keep menu open while toggling, matching shadcn checkbox-item idiom.
            e.preventDefault();
            toggleAll();
          }}
        >
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {TIMELINE_TAGS.map((t) => (
          <DropdownMenuCheckboxItem
            key={t}
            checked={currentTags.includes(t)}
            onSelect={(e) => {
              e.preventDefault();
              toggleTag(t);
            }}
          >
            {getTagLabel(t)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
