export interface MachineOption {
  id: string;
  initials: string;
  name: string;
}

/**
 * Chooses the default machine ID for the public report form.
 * Returns a valid machine ID only if explicitly requested via query param (machine or machineId).
 * Returns undefined when no machine is requested, allowing the form to start unselected.
 */
export function resolveDefaultMachineId(
  machines: MachineOption[],
  requestedMachineId: string | undefined,
  requestedMachineInitials: string | undefined
): string | undefined {
  if (machines.length === 0) {
    return undefined;
  }

  // Initials are stored uppercase, but the query param is hand-typeable
  // (`/report?machine=afm`) — match case-insensitively rather than 404-ing
  // into an unselected form. Same reasoning as `canonicalMachinePath`.
  const requestedInitials = requestedMachineInitials?.toUpperCase();
  const byInitials =
    requestedInitials &&
    machines.find((machine) => machine.initials === requestedInitials);

  if (byInitials) return byInitials.id;

  const byId =
    requestedMachineId &&
    machines.find((machine) => machine.id === requestedMachineId);

  if (byId) return byId.id;

  return undefined;
}
