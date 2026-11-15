/**
 * The severity/priority/frequency vocabularies as VALUE arrays, with the types
 * derived from them — the same array-is-the-source-of-truth shape
 * `ISSUE_STATUS_VALUES` uses in `~/lib/issues/status`.
 *
 * Runtime validators (Zod schemas, MCP tool inputs, URL filter parsers) need the
 * list of values, not just the type. When the type is hand-written each of those
 * sites re-types the literals, and adding a value to the type leaves every one
 * of them silently rejecting it — a valid severity the API refuses, with nothing
 * failing to compile. Spreading these arrays into `z.enum` instead makes the
 * type and the accepted set the same object.
 *
 * Severity uses the player-centric vocabulary (`pinpoint-design-bible`): never
 * low/medium/high, never "critical".
 */
export const ISSUE_SEVERITY_VALUES = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITY_VALUES)[number];

export const ISSUE_PRIORITY_VALUES = ["low", "medium", "high"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY_VALUES)[number];

export const ISSUE_FREQUENCY_VALUES = [
  "not_specified",
  "intermittent",
  "frequent",
  "constant",
] as const;
export type IssueFrequency = (typeof ISSUE_FREQUENCY_VALUES)[number];
