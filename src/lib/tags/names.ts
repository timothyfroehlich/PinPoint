import { z } from "zod";
import { TAG_TYPE_IDS, TAG_TYPES, UNTYPED_TAG_SEGMENT } from "./types";

/** Spec collections-and-tags 11.2–11.3. The database CHECKs the same cap. */
export const TAG_NAME_MAX = 20;

/**
 * The stored form of a tag or tag type name: trimmed, with each run of
 * whitespace collapsed to one space. Names that differ only that way, or in
 * capitalization, are the same name (spec 11.2).
 */
export function normalizeTagName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Two names are the same name when they match ignoring case (spec 11.2). */
export function sameTagName(left: string, right: string): boolean {
  return (
    normalizeTagName(left).toLowerCase() ===
    normalizeTagName(right).toLowerCase()
  );
}

/**
 * A URL slug for a name: lower-case ASCII letters and digits joined by single
 * hyphens. Accents fold to their base letter; a name with nothing left (only
 * symbols, or a non-Latin script) takes `fallback`.
 */
export function slugifyTagName(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? fallback : slug;
}

/** `base`, or the first of `base-2`, `base-3`, … that is not taken. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${String(suffix)}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The slug a tag type with no Latin letters or digits in its name takes. */
export const TAG_TYPE_SLUG_FALLBACK = "tag-type";
/** The slug a tag with no Latin letters or digits in its name takes. */
export const TAG_SLUG_FALLBACK = "tag";

/**
 * Why a hand-applied tag type cannot take this name, or null when it can. A
 * tag type's name is unique across automatic tag types too (spec 11.2), and
 * its slug cannot shadow an automatic tag type's page or the segment untyped
 * tags live under.
 */
export function reservedTagTypeNameError(name: string): string | null {
  const lower = normalizeTagName(name).toLowerCase();
  const slug = slugifyTagName(name, TAG_TYPE_SLUG_FALLBACK);
  const automatic = TAG_TYPE_IDS.some(
    (id) =>
      id === lower || id === slug || TAG_TYPES[id].label.toLowerCase() === lower
  );
  if (automatic) return "Name already used";
  if (slug === UNTYPED_TAG_SEGMENT) return "Name reserved";
  return null;
}

/**
 * A name's length in characters (code points), as the database's
 * `char_length` counts it; an emoji is one character, not two.
 */
export function tagNameLength(name: string): number {
  return [...name].length;
}

/** A tag or tag type name: normalized, required, at most 20 characters. */
export const tagNameSchema = z
  .string()
  .transform(normalizeTagName)
  .pipe(
    z
      .string()
      .min(1, "Name required")
      .refine(
        (name) => tagNameLength(name) <= TAG_NAME_MAX,
        `Name too long (max ${String(TAG_NAME_MAX)})`
      )
  );

/** A hand-applied tag type's name, which also may not shadow an automatic one. */
export const tagTypeNameSchema = tagNameSchema.superRefine((name, ctx) => {
  const error = reservedTagTypeNameError(name);
  if (error !== null) ctx.addIssue({ code: "custom", message: error });
});
