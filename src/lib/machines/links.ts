/**
 * A person's machines: the Machines list filtered to that Owner
 * (collections-and-tags §6.4, machine-views §4.2). Presence keeps its
 * On the Floor default. `ownerId` is a user id, or `me` for whoever is
 * viewing.
 */
export function ownerMachinesHref(ownerId: string): string {
  const params = new URLSearchParams({ owner: ownerId });
  return `/m?${params.toString()}`;
}
