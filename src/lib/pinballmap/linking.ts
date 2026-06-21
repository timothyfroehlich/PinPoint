/**
 * PinballMap linking rules — shared between the create and edit machine actions.
 *
 * This is deliberately plain logic (no env var, no DB flag): the linked-or-excluded
 * requirement is a reviewed one-line constant flip, not a runtime toggle. Keeping it
 * here lets both actions and the unit tests share one source of truth.
 */

/**
 * Whether creating/editing a machine must have a PinballMap catalog link OR the
 * "not on PinballMap" excluded flag set.
 *
 * Hardcoded `false` until the rollout backfill links every existing machine
 * (PP-o355 rollout). Flip to `true` in the follow-up PR after that backfill, so
 * no existing machine is ever caught unsaveable. The mutual-exclusion invariant
 * below is enforced regardless of this flag.
 */
export const PBM_LINKING_REQUIRED = false;

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
  /** Linking is required (flag on) but neither a link nor the excluded flag was set. */
  | "link_required";

/**
 * Validate a PinballMap link selection.
 *
 * - Mutual exclusion (linked AND excluded) is ALWAYS rejected — it mirrors the
 *   DB CHECK and is a data-integrity invariant independent of the flag.
 * - The linked-or-excluded requirement is gated by `required`
 *   (defaults to {@link PBM_LINKING_REQUIRED}).
 *
 * Returns the first error, or `null` when the selection is valid.
 */
export function validatePbmLinkSelection(
  selection: PbmLinkSelection,
  required: boolean = PBM_LINKING_REQUIRED
): PbmLinkValidationError | null {
  const hasLink = selection.pinballmapMachineId !== null;
  if (hasLink && selection.pinballmapExcluded) {
    return "both_link_and_excluded";
  }
  if (required && !hasLink && !selection.pinballmapExcluded) {
    return "link_required";
  }
  return null;
}
