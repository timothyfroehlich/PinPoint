"use client";

import type React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TIMELINE_TAGS,
  getTagLabel,
  type TimelineTag,
} from "~/lib/timeline/machine-tags";

const ALL = "__all__" as const;

interface Props {
  currentTag: TimelineTag | undefined;
}

export function MachineTimelineFilter({
  currentTag,
}: Props): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = currentTag ?? ALL;

  const handleChange = (next: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) {
      params.delete("tag");
    } else {
      params.set("tag", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger aria-label="Filter by tag" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All</SelectItem>
        {TIMELINE_TAGS.map((t) => (
          <SelectItem key={t} value={t}>
            {getTagLabel(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
