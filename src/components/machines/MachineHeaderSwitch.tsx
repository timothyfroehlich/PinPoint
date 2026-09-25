"use client";

import type React from "react";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * Picks the machine page's header for the active tab (PP-o355.43). The Info
 * tab (the `(tabs)` index, where the child segment is `null`) shows the
 * artwork hero below `md`; every other case shows the compact header. Both
 * are server-rendered and passed in — this only chooses between them, because
 * the layout that renders them cannot see which tab is active.
 */
export function MachineHeaderSwitch({
  hero,
  header,
}: {
  hero: React.ReactNode;
  header: React.ReactNode;
}): React.ReactNode {
  const segment = useSelectedLayoutSegment();
  if (hero == null || segment !== null) return header;

  return (
    <>
      <div className="-mb-2 md:hidden">{hero}</div>
      <div className="hidden md:block">{header}</div>
    </>
  );
}
