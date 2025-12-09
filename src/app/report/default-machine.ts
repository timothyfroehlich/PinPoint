export interface MachineOption {
  id: string;
  name: string;
}

/**
 * Chooses the default machine ID for the public report form.
 * Prefers a valid query param; otherwise falls back to the first machine.
 */
export function resolveDefaultMachineId(
  machines: MachineOption[],
  requestedMachineId: string | undefined
): string {
  if (machines.length === 0) {
    return "";
  }

  const found =
    requestedMachineId &&
    machines.find((machine) => machine.id === requestedMachineId);

  if (found) {
    return found.id;
  }

  return machines[0]?.id ?? "";
}
