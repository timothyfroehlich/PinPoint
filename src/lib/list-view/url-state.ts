/**
 * URL state helpers every List Host shares (spec list-views.md §9). Each
 * host owns its parameters and their meaning; these only read and write
 * values the same way everywhere: comma-separated canonical values,
 * validated page numbers and sizes, and the people sentinels.
 */

import { LIST_PAGE_SIZES, type ListPageSize } from "~/lib/types";

/** The read side of URLSearchParams, which server and client both supply. */
export interface ListSearchParams {
  get(name: string): string | null;
}

/** A route's raw search params as one URLSearchParams, lists comma-joined. */
export function toListSearchParams(
  values: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) params.set(key, value.join(","));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

/** The values of a URL list that `allowed` names, in the URL's order. */
export function parseUrlList<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T[] {
  if (!value) return [];
  const allowedSet = new Set<string>(allowed);
  return [...new Set(value.split(","))].filter((item): item is T =>
    allowedSet.has(item)
  );
}

/**
 * The values of `values` that `allowed` names, in `allowed`'s order. A filter
 * selection is a set, so one order keeps the same selection the same
 * configuration however it was made (list-views §9.3, §10.3).
 */
export function canonicalFilterValues<T extends string>(
  values: readonly string[],
  allowed: readonly T[]
): T[] {
  const selected = new Set(values);
  return allowed.filter((value) => selected.has(value));
}

/**
 * The person filter value for whoever is viewing. It is resolved per viewer
 * when the filter runs, so one URL or Saved View means each signed-in
 * person's own records; for an anonymous visitor the value is dropped.
 */
export const ME_PERSON_ID = "me";
/** How the Me shortcut is named. */
export const ME_PERSON_NAME = "Me";
/** The person filter value for records with nobody in that role. */
export const UNASSIGNED_PERSON_ID = "unassigned";
/** How the Unassigned shortcut and a record with nobody are named. */
export const UNASSIGNED_PERSON_NAME = "Unassigned";

const PEOPLE_SHORTCUTS = [ME_PERSON_ID, UNASSIGNED_PERSON_ID];

/**
 * A people selection in its canonical order: Me, then Unassigned, then
 * people by id. Ids are the only order every selection shares, since names
 * can change and an id may name nobody on a Surface (list-views §10.18).
 */
export function canonicalPeopleValues(values: readonly string[]): string[] {
  const unique = [...new Set(values)].filter(Boolean);
  const people = unique
    .filter((value) => !PEOPLE_SHORTCUTS.includes(value))
    .sort();
  return [...canonicalFilterValues(unique, PEOPLE_SHORTCUTS), ...people];
}

/** A positive whole number from the URL, else `fallback`. */
export function positiveInteger(
  value: string | null,
  fallback: number
): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function isListPageSize(value: number): value is ListPageSize {
  return LIST_PAGE_SIZES.some((size) => size === value);
}

/** A page size from the URL (list-views §5.7), else `fallback`. */
export function parsePageSize(
  value: string | null,
  fallback: ListPageSize
): ListPageSize {
  const requested = positiveInteger(value, fallback);
  return isListPageSize(requested) ? requested : fallback;
}

export function arraysEqual<T>(
  left: readonly T[],
  right: readonly T[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * A stored View Configuration as URL parameters, so a host can validate it
 * exactly as it validates a URL (list-views §10.14). Only `keys` are read;
 * a value that is neither text, a number, nor a list of text is dropped.
 */
export function storedStateParams(
  stored: unknown,
  keys: readonly string[]
): URLSearchParams {
  const params = new URLSearchParams();
  if (typeof stored !== "object" || stored === null) return params;
  for (const key of keys) {
    const value: unknown = Object.getOwnPropertyDescriptor(stored, key)?.value;
    if (typeof value === "string") params.set(key, value);
    else if (typeof value === "number" || typeof value === "boolean") {
      params.set(key, String(value));
    } else if (Array.isArray(value)) {
      params.set(
        key,
        value
          .filter((item): item is string => typeof item === "string")
          .join(",")
      );
    }
  }
  return params;
}
