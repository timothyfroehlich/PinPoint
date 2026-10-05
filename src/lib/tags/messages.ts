/**
 * Why a tag type cannot be made exclusive (spec collections-and-tags 11.7) or
 * a tag cannot move (11.16). The tag pages' dialogs show these before anyone
 * submits, and the Server Actions return the same words when they refuse.
 */

function machines(count: number): string {
  return `${String(count)} ${count === 1 ? "machine" : "machines"}`;
}

/** Making `typeName` exclusive is blocked by machines holding two of its tags. */
export function tooManyTagsMessage(typeName: string, count: number): string {
  return `${machines(count)} ${count === 1 ? "has" : "have"} more than one ${typeName} tag`;
}

/** Moving a tag into the exclusive `typeName` would double machines up. */
export function wouldHoldTwoMessage(typeName: string, count: number): string {
  return `${machines(count)} would hold two ${typeName} tags`;
}

/** Another tag where the tag is going has its name; null is no tag type. */
export function nameTakenMessage(
  typeName: string | null,
  tagName: string
): string {
  return typeName === null
    ? `Another tag with no type is named ${tagName}`
    : `${typeName} already has a tag named ${tagName}`;
}
