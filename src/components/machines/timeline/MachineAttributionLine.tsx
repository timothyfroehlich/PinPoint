import type React from "react";
import Link from "next/link";

export interface MachineLabel {
  name: string;
  href: string;
}

/**
 * Muted machine-name line above a timeline entry. Used ONLY by combined
 * (collection) feeds — per-machine timelines never pass machineLabel, so
 * their rendering is unchanged (spec: attribution style B1, PP-slrd.1).
 */
export function MachineAttributionLine({
  machine,
}: {
  machine: MachineLabel;
}): React.JSX.Element {
  return (
    <div
      data-testid="machine-attribution"
      className="mb-0.5 text-[11px] font-semibold text-muted-foreground"
    >
      <Link href={machine.href} className="hover:text-primary">
        {machine.name}
      </Link>
    </div>
  );
}
