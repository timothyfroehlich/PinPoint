/**
 * Canonical casing for the `/m/<initials>` URL segment.
 *
 * Machine initials are stored uppercase — the `machines` table carries a
 * `^[A-Z0-9]{2,6}$` check constraint — and every `/m/[initials]` route looks
 * them up with an exact match. So a hand-typed or lowercased link (`/m/afm`,
 * a QR scan retyped from memory, a URL an autocorrect touched) 404s while
 * `/m/AFM` works. Middleware redirects the lowercase form to the canonical
 * one rather than making the lookups case-insensitive, so there stays exactly
 * one URL per machine.
 */

/**
 * Static route segments that live under `/m/` and are NOT machine initials.
 * They must stay lowercase — uppercasing `/m/new` would send the create page
 * to a machine lookup for "NEW". Keep in sync with the directories under
 * `src/app/(app)/m/`.
 */
const RESERVED_SEGMENTS = new Set(["new"]);

/** Matches the shape of the initials column's check constraint, case-insensitively. */
const INITIALS_PATTERN = /^[A-Za-z0-9]{2,6}$/;

/**
 * Returns the canonical (uppercase-initials) form of a `/m/...` pathname, or
 * `null` when the path is already canonical or is not a machine path at all.
 *
 * Only the initials segment is touched; anything after it (`/i/12`,
 * `/maintenance`, `/edit`) is preserved verbatim, since those segments are
 * case-sensitive route names or numbers.
 */
export function canonicalMachinePath(pathname: string): string | null {
  const segments = pathname.split("/");
  // ["", "m", "<initials>", ...rest]
  if (segments[1] !== "m") return null;

  const initials = segments[2];
  if (!initials) return null;
  if (RESERVED_SEGMENTS.has(initials)) return null;
  if (!INITIALS_PATTERN.test(initials)) return null;

  const canonical = initials.toUpperCase();
  if (canonical === initials) return null;

  segments[2] = canonical;
  return segments.join("/");
}
