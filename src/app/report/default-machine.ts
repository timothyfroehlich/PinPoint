export interface MachineOption {
  id: string;
  initials: string;
  name: string;
}

/**
 * Chooses the default machine ID for the public report form.
 * Prefers a valid query param (machine or machineId); otherwise falls back to the first machine.
 */
export function resolveDefaultMachineId(
  machines: MachineOption[],
  requestedMachineId: string | undefined,
  requestedMachineInitials: string | undefined
): string {
  if (machines.length === 0) {
    return "";
  }

  const byInitials =
    requestedMachineInitials &&
    machines.find((machine) => machine.initials === requestedMachineInitials);

  if (byInitials) return byInitials.id;

  const byId =
    requestedMachineId &&
    machines.find((machine) => machine.id === requestedMachineId);

  if (byId) return byId.id;

  return machines[0]?.id ?? "";
}
