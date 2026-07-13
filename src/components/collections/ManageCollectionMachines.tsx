"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MultiSelect } from "~/components/ui/multi-select";
import { Button } from "~/components/ui/button";
import { updateCollectionMachinesAction } from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  allMachines: { id: string; initials: string; name: string }[];
  currentIds: string[];
}

export function ManageCollectionMachines({
  collectionId,
  allMachines,
  currentIds,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      allMachines.map((m) => ({
        label: m.name,
        value: m.id,
        badgeLabel: m.initials,
      })),
    [allMachines]
  );

  function save(): void {
    setError(null);
    startTransition(async () => {
      const result = await updateCollectionMachinesAction({
        collectionId,
        machineIds: selected,
      });
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <MultiSelect
        options={options}
        value={selected}
        onChange={setSelected}
        placeholder="Add machines…"
        searchPlaceholder="Search machines…"
        ariaLabel="Machines in this collection"
        className="w-64"
        data-testid="collection-machines-multiselect"
      />
      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save machines"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
