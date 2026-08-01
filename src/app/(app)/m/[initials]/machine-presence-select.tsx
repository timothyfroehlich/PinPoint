"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { updateMachinePresenceAction } from "~/app/(app)/m/actions";

interface MachinePresenceSelectProps {
  machineId: string;
  value: MachinePresenceStatus;
}

/**
 * Presence (availability) control for the Service tab's Machine box — the only
 * manual machine control (status is derived/read-only, design §4). A 5-state
 * `<select>` wired to `updateMachinePresenceAction`, which emits a
 * `presence_changed` lifecycle event that surfaces in the Activity feed.
 *
 * Optimistic-ish: the trigger shows the pending value immediately; on failure
 * it reverts and toasts. Only rendered for viewers who may edit the machine.
 */
export function MachinePresenceSelect({
  machineId,
  value,
}: MachinePresenceSelectProps): React.JSX.Element {
  const [current, setCurrent] = useState<MachinePresenceStatus>(value);
  const [isPending, startTransition] = useTransition();

  // Radix's `onValueChange` is typed `(value: string) => void`; narrowing the
  // param to `MachinePresenceStatus` here is sound because every `SelectItem`
  // value is drawn from `VALID_MACHINE_PRESENCE_STATUSES`, and the server action
  // re-validates. Matches the codebase Select pattern (e.g. `StatusSelect`),
  // avoiding an unsafe `as` cast (CORE-TS-007).
  function handleChange(next: MachinePresenceStatus): void {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const result = await updateMachinePresenceAction(machineId, next);
      if (result.ok) {
        toast.success(`Availability set to ${getMachinePresenceLabel(next)}`);
      } else {
        setCurrent(previous);
        toast.error(result.message);
      }
    });
  }

  return (
    <Select value={current} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger
        className="w-full"
        aria-label="Machine availability"
        data-testid="machine-presence-select"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VALID_MACHINE_PRESENCE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {getMachinePresenceLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
