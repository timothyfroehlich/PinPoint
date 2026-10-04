import type React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";

interface TagChipProps {
  href: string;
  name: string;
  machineCount: number;
}

/**
 * One tag in the tag browse: its name and machine count. A hand-applied tag
 * with no machines is drawn dashed and dimmed (spec 11.13).
 */
export function TagChip({
  href,
  name,
  machineCount,
}: TagChipProps): React.JSX.Element {
  const empty = machineCount === 0;
  return (
    <Link
      href={href}
      aria-label={`${name}, ${
        empty
          ? "no machines"
          : `${String(machineCount)} ${machineCount === 1 ? "machine" : "machines"}`
      }`}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 text-[13px] font-medium transition-colors hover:border-primary motion-reduce:transition-none md:h-8",
        empty
          ? "border-dashed border-outline-variant text-muted-foreground"
          : "border-outline-variant text-foreground"
      )}
    >
      <span className="truncate">{name}</span>
      <span
        aria-hidden="true"
        className="text-xs font-normal tabular-nums text-muted-foreground"
      >
        {machineCount}
      </span>
    </Link>
  );
}
