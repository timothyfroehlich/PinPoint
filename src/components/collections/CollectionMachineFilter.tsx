"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MultiSelect } from "~/components/ui/multi-select";

interface Props {
  machines: { initials: string; name: string }[];
  currentInitials: string[];
}

/**
 * Machine multi-select for combined (collection) timeline feeds. Same URL
 * pattern as {@link MachineTimelineFilter}: empty selection = no `?m=` param
 * = all machines in the collection; `?m=GZ,MM` = explicit subset.
 */
export function CollectionMachineFilter({
  machines,
  currentInitials,
}: Props): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = React.useMemo(
    () =>
      machines.map((m) => ({
        label: m.name,
        value: m.initials,
        badgeLabel: m.initials,
      })),
    [machines]
  );

  const writeMachines = (next: string[]): void => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete("m");
    else params.set("m", next.join(","));
    params.delete("page"); // filter change resets pagination
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <MultiSelect
      options={options}
      value={currentInitials}
      onChange={writeMachines}
      placeholder="Machines"
      searchPlaceholder="Filter machines…"
      ariaLabel="Filter by machine"
      className="w-44"
    />
  );
}
