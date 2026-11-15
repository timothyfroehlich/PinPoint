import {
  docToPlainText,
  proseMirrorDocSchema,
  type ProseMirrorDoc,
} from "~/lib/tiptap/types";

/**
 * The outcome of validating an untrusted ProseMirror payload for a stored prose
 * column. Callers map it to their own error shape and copy. `"empty"` means
 * whitespace-only: callers store NULL rather than a semantically empty doc.
 */
export type ProseMirrorValidation =
  | { status: "invalid" }
  | { status: "too-long" }
  | { status: "empty" }
  | { status: "ok"; doc: ProseMirrorDoc };

/**
 * Validate an untrusted ProseMirror payload for a stored prose column (machine
 * description and owner's requirements, Collection description). One shared
 * check so the edit surfaces can't drift on what counts as a valid, oversized,
 * or empty doc. Size caps: 10k plain text / 100k serialized JSON.
 */
export function validateProseMirrorDoc(value: unknown): ProseMirrorValidation {
  // Validate the untrusted value at runtime BEFORE treating it as a doc — the
  // raw parse result is `unknown`, and only a successful safeParse licenses the
  // narrow below (CORE-TS-007: no unsafe cast of unvalidated input).
  if (!proseMirrorDocSchema.safeParse(value).success) {
    return { status: "invalid" };
  }
  // Shape confirmed (`type: "doc"`); narrow the validated `unknown` to the app's
  // doc type.
  const doc = value as ProseMirrorDoc;
  const plainText = docToPlainText(doc);
  if (plainText.length > 10_000 || JSON.stringify(doc).length > 100_000) {
    return { status: "too-long" };
  }
  if (plainText.trim().length === 0) {
    return { status: "empty" };
  }
  return { status: "ok", doc };
}
