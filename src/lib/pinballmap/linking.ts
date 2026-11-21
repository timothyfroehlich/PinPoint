/**
 * PinballMap linking rules — shared between the create and edit machine actions.
 *
 * This is deliberately plain logic (no env var, no DB flag). Keeping it here lets
 * both actions and the unit tests share one source of truth.
 */

/** A machine's PinballMap link selection, as resolved from a create/edit form. */
export interface PbmLinkSelection {
  /** PBM catalog machine id, or null when not linked. */
  pinballmapMachineId: number | null;
  /** Explicit "not on PinballMap" flag. */
  pinballmapExcluded: boolean;
}

export type PbmLinkValidationError =
  /** A machine cannot be both linked to PBM and marked excluded from it. */
  | "both_link_and_excluded"
  /** Creating/editing a machine needs a link or the excluded flag; neither was set. */
  | "link_required";

/**
 * Validate a PinballMap link selection.
 *
 * - Mutual exclusion (linked AND excluded) is rejected — it mirrors the DB CHECK.
 * - A machine must be linked OR marked excluded.
 *
 * Returns the first error, or `null` when the selection is valid.
 */
export function validatePbmLinkSelection(
  selection: PbmLinkSelection
): PbmLinkValidationError | null {
  const hasLink = selection.pinballmapMachineId !== null;
  if (hasLink && selection.pinballmapExcluded) {
    return "both_link_and_excluded";
  }
  if (!hasLink && !selection.pinballmapExcluded) {
    return "link_required";
  }
  return null;
}
