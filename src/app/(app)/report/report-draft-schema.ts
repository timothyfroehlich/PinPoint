import { z } from "zod";
import {
  ISSUE_STATUS_VALUES,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  FREQUENCY_CONFIG,
} from "~/lib/issues/status";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";
import { proseMirrorDocValueSchema } from "~/lib/tiptap/types";
import type { ImageMetadata } from "~/types/images";

/**
 * Unified report draft (PP-idrb) — the shape persisted to `localStorage` for
 * the tabbed report page. `entries[0]` is "entry #1": the single issue shared
 * between the Single form and grid row 1. Additional entries are extra grid
 * rows. `single` holds the fields that live ONLY on the detailed Single form
 * (reporter identity + photos) and never sync to the grid (CORE-SEC-007).
 *
 * This is the PERSISTENCE schema, deliberately more permissive than the submit
 * schemas (`report/schemas.ts`, `report/quick/schemas.ts`): a draft entry may
 * be blank or half-filled. Submit-time validation still runs on send.
 */

// Enum value tuples derived from the canonical config objects so this file
// never re-declares the literal sets (CORE-ARCH-010).
const SEVERITY_VALUES = Object.keys(SEVERITY_CONFIG) as [
  IssueSeverity,
  ...IssueSeverity[],
];
const PRIORITY_VALUES = Object.keys(PRIORITY_CONFIG) as [
  IssuePriority,
  ...IssuePriority[],
];
const FREQUENCY_VALUES = Object.keys(FREQUENCY_CONFIG) as [
  IssueFrequency,
  ...IssueFrequency[],
];

export const DRAFT_VERSION = 2 as const;
/** Persistence key for the unified draft. Supersedes `report_form_state`. */
export const REPORT_DRAFT_KEY = "report_draft";
/** Legacy single-form persistence key, migrated on first load then removed. */
export const LEGACY_DRAFT_KEY = "report_form_state";

export const sharedEntrySchema = z.object({
  // Blank-tolerant: a draft row may have no machine/title yet. Submit-time
  // validation (quickRowSchema / publicIssueSchema) enforces the real rules.
  machineId: z.string(),
  title: z.string(),
  description: proseMirrorDocValueSchema.nullable(),
  severity: z.enum(SEVERITY_VALUES),
  priority: z.enum(PRIORITY_VALUES),
  status: z.enum(ISSUE_STATUS_VALUES),
  frequency: z.enum(FREQUENCY_VALUES),
  assignedTo: z.string(),
  watch: z.boolean(),
  // Minted per entry; stable across retries so a resubmit is deduped (PP-2053.7).
  idempotencyKey: z.string().uuid(),
});
export type SharedEntry = z.infer<typeof sharedEntrySchema>;

/**
 * Image-metadata guard mirroring unified-report-form.tsx: only rows carrying
 * every field `imagesMetadataArraySchema` requires survive, so a malformed
 * legacy draft can't silently poison submission (PP-2053.6).
 */
export function isValidImageMetadata(img: unknown): img is ImageMetadata {
  if (typeof img !== "object" || img === null) return false;
  const m = img as Record<string, unknown>;
  return (
    typeof m["blobUrl"] === "string" &&
    typeof m["blobPathname"] === "string" &&
    typeof m["originalFilename"] === "string" &&
    m["originalFilename"].length > 0 &&
    typeof m["fileSizeBytes"] === "number" &&
    m["fileSizeBytes"] > 0 &&
    typeof m["mimeType"] === "string" &&
    m["mimeType"].startsWith("image/")
  );
}

export const singleOnlySchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  // Validated loosely then hardened via isValidImageMetadata below.
  uploadedImages: z.array(z.unknown()),
});
export type SingleOnlyState = Omit<
  z.infer<typeof singleOnlySchema>,
  "uploadedImages"
> & { uploadedImages: ImageMetadata[] };

export const reportDraftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  entries: z.array(sharedEntrySchema).min(1),
  single: singleOnlySchema,
});

export interface ReportDraft {
  version: typeof DRAFT_VERSION;
  entries: SharedEntry[];
  single: SingleOnlyState;
}

/** Default synced fields for a fresh entry #1 (mirrors the Single form's
 *  defaults, since Single is the default tab). `idempotencyKey` is supplied by
 *  the caller so tests are deterministic and the store owns key rotation. */
export function defaultEntry(idempotencyKey: string): SharedEntry {
  return {
    machineId: "",
    title: "",
    description: null,
    severity: "minor",
    priority: "medium",
    status: "new",
    frequency: "constant",
    assignedTo: "",
    watch: true,
    idempotencyKey,
  };
}

export function emptySingle(): SingleOnlyState {
  return { firstName: "", lastName: "", email: "", uploadedImages: [] };
}

function hardenSingle(raw: z.infer<typeof singleOnlySchema>): SingleOnlyState {
  return {
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    uploadedImages: raw.uploadedImages.filter(isValidImageMetadata),
  };
}

/** Legacy `report_form_state` (single-form shape) → unified draft. Returns null
 *  when the payload isn't recognizably the legacy shape. */
function migrateLegacy(json: unknown): ReportDraft | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  // A legacy draft is keyed by `machineId`/`title`/`watchIssue`; the new shape
  // has `version`/`entries`. If it already looks new, it's not legacy.
  if ("version" in o || "entries" in o) return null;

  const key =
    typeof o["idempotencyKey"] === "string" && o["idempotencyKey"].length > 0
      ? o["idempotencyKey"]
      : crypto.randomUUID();

  const descParse = proseMirrorDocValueSchema.safeParse(o["description"]);
  const entry: SharedEntry = {
    ...defaultEntry(key),
    machineId: typeof o["machineId"] === "string" ? o["machineId"] : "",
    title: typeof o["title"] === "string" ? o["title"] : "",
    description: descParse.success ? descParse.data : null,
    watch: typeof o["watchIssue"] === "boolean" ? o["watchIssue"] : true,
  };
  // Carry enum fields only when they're valid; otherwise keep the default.
  const sev = SEVERITY_VALUES as readonly string[];
  const pri = PRIORITY_VALUES as readonly string[];
  const freq = FREQUENCY_VALUES as readonly string[];
  if (typeof o["severity"] === "string" && sev.includes(o["severity"]))
    entry.severity = o["severity"] as IssueSeverity;
  if (typeof o["priority"] === "string" && pri.includes(o["priority"]))
    entry.priority = o["priority"] as IssuePriority;
  if (typeof o["frequency"] === "string" && freq.includes(o["frequency"]))
    entry.frequency = o["frequency"] as IssueFrequency;

  const single: SingleOnlyState = {
    firstName: typeof o["firstName"] === "string" ? o["firstName"] : "",
    lastName: typeof o["lastName"] === "string" ? o["lastName"] : "",
    email: typeof o["email"] === "string" ? o["email"] : "",
    uploadedImages: Array.isArray(o["uploadedImages"])
      ? o["uploadedImages"].filter(isValidImageMetadata)
      : [],
  };

  return { version: DRAFT_VERSION, entries: [entry], single };
}

/**
 * Parse a persisted draft string. Tries the current schema first, then a
 * legacy migration, then gives up with `null` (caller clears storage). Never
 * throws — a corrupt draft must not break the report page.
 */
export function parseDraft(raw: string | null): ReportDraft | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const current = reportDraftSchema.safeParse(json);
  if (current.success) {
    return {
      version: DRAFT_VERSION,
      entries: current.data.entries,
      single: hardenSingle(current.data.single),
    };
  }
  return migrateLegacy(json);
}

export function serializeDraft(draft: ReportDraft): string {
  return JSON.stringify(draft);
}
