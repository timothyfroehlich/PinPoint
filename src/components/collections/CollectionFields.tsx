"use client";

import type React from "react";
import { useMemo } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MultiSelect } from "~/components/ui/multi-select";

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  allMachines: { id: string; initials: string; name: string }[];
  /** Prefix for the name field id, so create + edit dialogs don't collide. */
  idPrefix?: string;
}

/**
 * The shared "name + machine set" form body used by both the create and edit
 * collection dialogs (the load-bearing duplicate — DRYed at two per Tim's
 * Rule-of-Three caveat). Fully controlled; the parent owns submit + errors.
 */
export function CollectionFields({
  name,
  onNameChange,
  selected,
  onSelectedChange,
  allMachines,
  idPrefix = "collection",
}: Props): React.JSX.Element {
  const options = useMemo(
    () =>
      allMachines.map((m) => ({
        label: m.name,
        value: m.id,
        badgeLabel: m.initials,
      })),
    [allMachines]
  );
  const nameId = `${idPrefix}-name`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          maxLength={120}
          enterKeyHint="done"
        />
      </div>

      <div className="space-y-2">
        <Label>Machines</Label>
        <MultiSelect
          options={options}
          value={selected}
          onChange={onSelectedChange}
          placeholder="Add machines…"
          searchPlaceholder="Search machines…"
          ariaLabel="Machines in this collection"
          className="w-full"
          data-testid="collection-machines-multiselect"
        />
      </div>
    </div>
  );
}
