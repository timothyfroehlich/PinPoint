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
/**
 * A repeated query param (`?machine=afm&machine=bbh`) arrives as an array, so
 * both params are typed as the App Router actually delivers them. An array is
 * an ambiguous request — it names two machines — and resolves to no
 * preselection rather than an arbitrary one.
 */
type QueryParam = string | string[] | undefined;

const singleValue = (param: QueryParam): string | undefined =>
  typeof param === "string" ? param : undefined;

export function resolveDefaultMachineId(
  machines: MachineOption[],
  requestedMachineId: QueryParam,
  requestedMachineInitials: QueryParam
): string | undefined {
  if (machines.length === 0) {
    return undefined;
  }

  // Initials are stored uppercase, but the query param is hand-typeable
  // (`/report?machine=afm`) — match case-insensitively rather than dropping
  // into an unselected form. Same reasoning as `canonicalMachinePath`.
  const requestedInitials = singleValue(
    requestedMachineInitials
  )?.toUpperCase();
  const byInitials =
    requestedInitials &&
    machines.find((machine) => machine.initials === requestedInitials);

  if (byInitials) return byInitials.id;

  const requestedId = singleValue(requestedMachineId);
  const byId =
    requestedId && machines.find((machine) => machine.id === requestedId);

  if (byId) return byId.id;

  return undefined;
}
