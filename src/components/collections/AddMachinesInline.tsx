"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { MultiSelect } from "~/components/ui/multi-select";
import { updateCollectionAction } from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  collectionName: string;
  allMachines: { id: string; initials: string; name: string }[];
}

/**
 * Empty-state affordance shown to the owner of a machine-less collection:
 * pick machines and add them right away, so a freshly-created collection is
 * immediately fillable without opening the edit modal. Reuses the unified
 * `updateCollectionAction` (name unchanged + the chosen machine set).
 */
export function AddMachinesInline({
  collectionId,
  collectionName,
  allMachines,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () =>
      allMachines.map((m) => ({
        label: m.name,
        value: m.id,
        badgeLabel: m.initials,
      })),
    [allMachines]
  );

  function add(): void {
    setError(null);
    startTransition(async () => {
      const result = await updateCollectionAction({
        collectionId,
        name: collectionName,
        machineIds: selected,
      });
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        This collection is empty. Add machines to get started.
      </p>
      <div className="flex items-center gap-2">
        <MultiSelect
          options={options}
          value={selected}
          onChange={setSelected}
          placeholder="Add machines…"
          searchPlaceholder="Search machines…"
          ariaLabel="Machines to add"
          className="w-64"
          data-testid="collection-machines-multiselect"
        />
        <Button
          onClick={add}
          loading={pending}
          disabled={selected.length === 0}
          data-testid="collection-add-machines"
        >
          {pending ? "Adding…" : "Add machines"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
