/**
 * Machine Server Actions
 *
 * Server-side mutations for machine CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { after } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { db, type DbTransaction } from "~/server/db";
import {
  applyMachinePbmLink,
  createMachine,
  carryExcludedReason,
  IC_INELIGIBLE_MESSAGE,
  isTitleIcEligible,
  planMachinePbmLink,
  updateMachinePresence,
  type Machine,
  type MachinePbmLinkPlan,
} from "~/services/machines";
import { PBM_ADD_FAILED_PARAM } from "~/lib/pinballmap/create-flow";
import {
  machines,
  machineWatchers,
  userProfiles,
  invitedUsers,
} from "~/server/db/schema";
import { createMachineSchema, updateMachineSchema } from "./schemas";
import { resolvePbmLinkColumnsForCreate } from "~/lib/pinballmap/link-columns";
import { importPinballMapCommentsAfterCoverageChange } from "~/lib/pinballmap/comment-import";
import type { PbmIcIntent } from "~/lib/pinballmap/insider-connected";
import { addMachineToPinballMapAction } from "./pinballmap-actions";
import { type Result, ok, err } from "~/lib/result";
import { z } from "zod";
import { eq, and, exists } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { log } from "~/lib/logger";
import {
  planNotification,
  dispatchNotification,
  getChannels,
} from "~/lib/notifications";
import {
  reportError,
  serverActionError,
} from "~/lib/observability/report-error";
import { type ProseMirrorDoc, withoutMentionLabels } from "~/lib/tiptap/types";
import { validateProseMirrorDoc } from "~/lib/tiptap/validate";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { getPermission } from "~/lib/permissions/matrix";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import {
  emitMachineUpdated,
  toMachineOwnerRef,
} from "~/lib/timeline/machine-lifecycle-helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";

/**
 * Maps a prose-field column name to its marker lifecycle event kind.
 *
 * Only owner-facing edits emit a timeline event — `description` is
 * intentionally absent because its edit cadence is high enough that
 * emitting on every save floods the timeline with low-signal "description
 * updated" rows (PP-0x98 V2 design pass). The field itself is still
 * editable; the change just doesn't get duplicated into the activity feed.
 */
/** Subset of {@link MachineTimelineEventKind} that this map ever produces.
 *  Pinning the value type to the literal-string union keeps the
 *  `{ kind: ... }` event-data construction below assignable to the full
 *  discriminated `MachineTimelineEventData` union (TS otherwise widens
 *  to the whole 16-variant kind and demands the issue-event fields). */
type ProseFieldEventKind = "owner_requirements_updated";

const PROSE_FIELD_TO_EVENT_KIND: Partial<
  Record<"description" | "ownerRequirements", ProseFieldEventKind>
> = {
  ownerRequirements: "owner_requirements_updated",
};

/**
 * Canonical-JSON serializer with deterministic key ordering. Used to compare
 * before/after ProseMirror documents inside `updateMachineTextField` — PG
 * stores JSONB without preserving the source key order, so a naive
 * `JSON.stringify` round-trip would falsely report changes whenever the
 * client-supplied key order differs from PG's normalized order.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown): unknown => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>);
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return Object.fromEntries(entries);
    }
    return val;
  });
}

/**
 * Whether a submitted prose value differs from the stored one. Mention labels
 * are ignored: editors open on docs whose labels carry current names
 * (PP-0fg0.2), so an untouched save after a rename differs from storage only
 * in labels and is not an edit. A real edit still writes the submitted doc,
 * current labels included.
 */
function proseChanged(
  stored: ProseMirrorDoc | null,
  submitted: ProseMirrorDoc | null
): boolean {
  return (
    canonicalJson(withoutMentionLabels(stored)) !==
    canonicalJson(withoutMentionLabels(submitted))
  );
}

/** The `owner_requirements_updated` marker event, inside the caller's tx. */
async function emitOwnerRequirementsUpdated(
  tx: DbTransaction,
  machineId: string,
  actorId: string
): Promise<void> {
  await createMachineTimelineEvent(
    machineId,
    {
      sourceType: "lifecycle",
      tag: "lifecycle",
      eventData: { kind: "owner_requirements_updated" },
      actorId,
    },
    tx
  );
}

const NEXT_REDIRECT_DIGEST_PREFIX = "NEXT_REDIRECT;";

/**
 * Sentinel thrown from inside `updateMachineAction`'s transaction when the
 * UPDATE returns no rows (machine deleted between the load and the update).
 * Caught at the top-level handler so we can return `NOT_FOUND` rather than
 * surfacing a generic server error.
 */
class MachineNotFoundError extends Error {
  constructor() {
    super("Machine not found");
    this.name = "MachineNotFoundError";
  }
}

const isNextRedirectError = (error: unknown): error is { digest: string } => {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  const { digest } = error as { digest?: unknown };
  return (
    typeof digest === "string" && digest.startsWith(NEXT_REDIRECT_DIGEST_PREFIX)
  );
};

export interface AssigneeNotMemberMeta {
  assignee: {
    id: string;
    name: string;
    role: "guest";
    type: "active" | "invited";
  };
}

export type CreateMachineResult = Result<
  { machineId: string; redirectTo: string },
  "VALIDATION" | "UNAUTHORIZED" | "SERVER" | "ASSIGNEE_NOT_MEMBER",
  AssigneeNotMemberMeta
>;

export type UpdateMachineResult = Result<
  { machineId: string },
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER"
  | "ASSIGNEE_NOT_MEMBER",
  AssigneeNotMemberMeta
>;

export type DeleteMachineResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "SERVER"
>;

const deleteMachineSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Machine ID is required")
    .uuid("Invalid machine ID"),
});

/** True when the submitted form expresses any PinballMap link intent. */
function wantsPbmLinkChange(input: {
  pinballmapMachineId?: number | undefined;
  pinballmapExcluded?: boolean | undefined;
  pinballmapExcludedReason?: string | undefined;
}): boolean {
  return (
    input.pinballmapMachineId !== undefined ||
    input.pinballmapExcluded === true ||
    input.pinballmapExcludedReason !== undefined
  );
}

/**
 * Pull the raw PinballMap link fields off a create/edit FormData for Zod parsing.
 * `pinballmapMachineId` stays a string (the schema coerces it); the excluded
 * checkbox becomes `true`/`undefined`; a blank reason becomes `undefined`.
 *
 * Listing intent is **not** read here, on purpose — see the note in
 * `./schemas.ts` (PP-o355.29). It comes from the toggle's own action, or from
 * the stored row on the carry-over below; never from a request body.
 */
function readPbmLinkFormFields(formData: FormData): {
  pinballmapMachineId: string | undefined;
  pinballmapExcluded: boolean | undefined;
  pinballmapExcludedReason: string | undefined;
  modelName: string | undefined;
  manufacturer: string | undefined;
  year: string | undefined;
  type: string | undefined;
  display: string | undefined;
  playerCount: string | undefined;
  designers: string[] | undefined;
  artists: string[] | undefined;
} {
  const idRaw = formData.get("pinballmapMachineId");
  const nonEmpty = (key: string): string | undefined => {
    const raw = formData.get(key);
    return typeof raw === "string" && raw.trim().length > 0 ? raw : undefined;
  };
  const nameList = (key: string): string[] =>
    formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
  return {
    pinballmapMachineId:
      typeof idRaw === "string" && idRaw.length > 0 ? idRaw : undefined,
    pinballmapExcluded:
      formData.get("pinballmapExcluded") === "on" ? true : undefined,
    pinballmapExcludedReason: nonEmpty("pinballmapExcludedReason"),
    // Hand-entered model identity (PP-3bbr). Blank means "not given", which the
    // excluded branch stores as null — the fields are optional, and an empty
    // Year must not coerce to 0 and fail the 1930 floor.
    modelName: nonEmpty("modelName"),
    manufacturer: nonEmpty("manufacturer"),
    year: nonEmpty("year"),
    // The rest of the manual model (PP-wqit.14). Type and display post their
    // vocabulary value, or blank for "not set".
    type: nonEmpty("type"),
    display: nonEmpty("display"),
    playerCount: nonEmpty("playerCount"),
    // One entry per name, in order. Absent entirely is an empty list, which
    // the excluded branch stores as null — the form always posts the whole
    // manual model, so no entries means the person removed every name.
    designers: nameList("designers"),
    artists: nameList("artists"),
  };
}

/** A trimmed, non-empty string form value, or undefined. */
function optionalFormString(
  formData: FormData,
  key: string
): string | undefined {
  const raw = formData.get(key);
  return typeof raw === "string" && raw.trim().length > 0
    ? raw.trim()
    : undefined;
}

/**
 * The New Machine page's Insider Connected choice, checked the way
 * `setMachineIcIntent` checks the Manage tab's switch: only a catalog title
 * Pinball Map marks eligible carries one (pinballmap 3.8). Absent is "not
 * recorded".
 */
async function resolveIcIntentForCreate(
  requested: PbmIcIntent | undefined,
  pinballmapMachineId: number | null
): Promise<
  { ok: true; value: PbmIcIntent | null } | { ok: false; message: string }
> {
  if (requested === undefined) return { ok: true, value: null };
  if (pinballmapMachineId === null) {
    return {
      ok: false,
      message: "Insider Connected needs a Pinball Map title.",
    };
  }
  if (!(await isTitleIcEligible(pinballmapMachineId))) {
    return { ok: false, message: IC_INELIGIBLE_MESSAGE };
  }
  return { ok: true, value: requested };
}

/**
 * What a create with intent On owes afterwards (pinballmap 4.11), and where
 * the person lands.
 *
 * Intent On makes the new cabinet a covering one, owed its entry's comments —
 * the same import the Manage tab's toggle runs (7.1). When the person ticked
 * "Add to Pinball Map after creating", the add push runs through the very
 * action the Manage tab's Add button calls, so it re-checks the push
 * capability, the credential, and availability itself.
 *
 * Neither can undo the create. The machine exists whatever Pinball Map says;
 * a failed add sends the person to the Manage tab, where the machine reads as
 * out of sync with Add offered again, and a note says the add failed.
 */
async function applyPinballmapAfterCreate(
  machine: Pick<Machine, "id" | "initials" | "pinballmapIntent">,
  addAfterCreate: boolean
): Promise<string> {
  const infoPath = `/m/${machine.initials}`;
  if (machine.pinballmapIntent !== "on") return infoPath;

  try {
    await importPinballMapCommentsAfterCoverageChange();
  } catch (error: unknown) {
    reportError(error, {
      action: "createMachinePinballmapImport",
      bestEffort: true,
      machineId: machine.id,
    });
  }
  // Coverage is a property of the whole same-title group (4.7).
  revalidatePath("/m", "layout");

  if (!addAfterCreate) return infoPath;

  const addForm = new FormData();
  addForm.set("machineId", machine.id);
  try {
    const added = await addMachineToPinballMapAction(undefined, addForm);
    if (added.ok) return infoPath;
    log.warn(
      { machineId: machine.id, code: added.code },
      "Add to Pinball Map after create failed"
    );
  } catch (error: unknown) {
    reportError(error, {
      action: "createMachinePinballmapAdd",
      bestEffort: true,
      machineId: machine.id,
    });
  }
  return `/m/${machine.initials}/edit?${PBM_ADD_FAILED_PARAM}=1`;
}

/**
 * Create Machine Action
 *
 * Creates a new machine with validation.
 * Requires authentication (CORE-SEC-001).
 * Validates input with Zod (CORE-SEC-002).
 *
 * @param _prevState - The previous state of the form.
 * @param formData - Form data from machine creation form
 * @returns The result of the action.
 */
export async function createMachineAction(
  _prevState: CreateMachineResult | undefined,
  formData: FormData
): Promise<CreateMachineResult> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Fetch user profile to check role
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    return err("UNAUTHORIZED", "User profile not found.");
  }

  const accessLevel = getAccessLevel(profile.role);

  // Access control: only admins or technicians can create machines
  if (!checkPermission("machines.create", accessLevel)) {
    log.warn(
      { userId: user.id, action: "createMachineAction" },
      "Unauthorized user attempted to create a machine"
    );
    return err(
      "UNAUTHORIZED",
      "You must be an admin or technician to create a machine."
    );
  }

  // Extract form data
  const rawData = {
    name: formData.get("name"),
    initials: formData.get("initials"),
    ownerId:
      typeof formData.get("ownerId") === "string" &&
      (formData.get("ownerId") as string).length > 0
        ? (formData.get("ownerId") as string)
        : undefined,
    presenceStatus:
      typeof formData.get("presenceStatus") === "string" &&
      (formData.get("presenceStatus") as string).length > 0
        ? (formData.get("presenceStatus") as string)
        : undefined,
    forcePromoteUserId:
      typeof formData.get("forcePromoteUserId") === "string" &&
      (formData.get("forcePromoteUserId") as string).length > 0
        ? (formData.get("forcePromoteUserId") as string)
        : undefined,
    iscoredGameId: (() => {
      if (!formData.has("iscoredGameId")) return undefined;
      const raw = formData.get("iscoredGameId");
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
      }
      return null;
    })(),
    ...readPbmLinkFormFields(formData),
    // The New Machine page's Pinball Map choices (pinballmap 4.11). Absent
    // means Off / not recorded.
    pinballmapIntent: optionalFormString(formData, "pinballmapIntent"),
    pinballmapIcIntent: optionalFormString(formData, "pinballmapIcIntent"),
  };

  // Description and Owner's Requirements carried by the create form's rich
  // text editors, same hidden-field + JSON pattern as the edit form.
  const descriptionResult = parseProseFormField(formData, "description");
  if (!descriptionResult.ok) {
    return err("VALIDATION", descriptionResult.message);
  }
  const descriptionColumn = descriptionResult.value;
  const ownerRequirementsResult = parseProseFormField(
    formData,
    "ownerRequirements"
  );
  if (!ownerRequirementsResult.ok) {
    return err("VALIDATION", ownerRequirementsResult.message);
  }
  const ownerRequirementsColumn = ownerRequirementsResult.value;
  // Ticking "Add to Pinball Map after creating" is the 4.5 confirmation for
  // the add push. It means nothing unless intent is On, checked below.
  const addToPinballmapAfterCreate = formData.get("pbmAddAfterCreate") === "1";

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const {
    name,
    initials,
    ownerId,
    presenceStatus,
    forcePromoteUserId,
    iscoredGameId,
  } = validation.data;

  // Resolve PinballMap link columns (mutual-exclusion + catalog-derived metadata).
  // Creators are tech/admin (machines.create), who always hold the link
  // permission; the explicit check keeps this honest if that ever changes.
  //
  // Intent and Insider Connected ride the same gate: setting either is the
  // machine-linking capability (pinballmap 8.1).
  if (
    (wantsPbmLinkChange(validation.data) ||
      validation.data.pinballmapIntent !== undefined ||
      validation.data.pinballmapIcIntent !== undefined) &&
    !checkPermission("machines.pinballmap.link", accessLevel)
  ) {
    return err(
      "UNAUTHORIZED",
      "You do not have permission to link machines to Pinball Map."
    );
  }
  const pbm = await resolvePbmLinkColumnsForCreate(
    { ...validation.data, intent: validation.data.pinballmapIntent },
    validation.data.presenceStatus
  );
  if (!pbm.ok) return err("VALIDATION", pbm.message);
  const pbmColumns = pbm.columns;
  const icIntent = await resolveIcIntentForCreate(
    validation.data.pinballmapIcIntent,
    pbmColumns.pinballmapMachineId
  );
  if (!icIntent.ok) return err("VALIDATION", icIntent.message);

  // Handle forcePromoteUserId path: gate, validate, then wrap in transaction
  if (forcePromoteUserId !== undefined) {
    if (!checkPermission("admin.users.promote.guestToMember", accessLevel)) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to promote users."
      );
    }
    if (forcePromoteUserId !== ownerId) {
      return err(
        "VALIDATION",
        "forcePromoteUserId must match the selected owner."
      );
    }
    // Verify target user exists and is a guest
    const targetActive = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, forcePromoteUserId),
    });
    const targetInvited = targetActive
      ? null
      : await db.query.invitedUsers.findFirst({
          where: eq(invitedUsers.id, forcePromoteUserId),
        });
    if (!targetActive && !targetInvited) {
      return err("VALIDATION", "Selected user does not exist.");
    }
    // permissions-audit-allow: business-logic pre-condition for promotion, not a permission gate
    if ((targetActive?.role ?? targetInvited?.role) !== "guest") {
      return err("VALIDATION", "Selected user is not a guest.");
    }

    // Atomic promote + create, delegated to the service (transaction + owner
    // watcher + lifecycle + notification planning). `promoteGuest.type` selects
    // the owner column and gates the "added" notification — only an active
    // promotion notified in the original.
    try {
      const { machine, deliveryPlan } = await createMachine({
        name,
        initials,
        actorUserId: user.id,
        ownerId: targetActive ? forcePromoteUserId : null,
        invitedOwnerId: targetInvited ? forcePromoteUserId : null,
        presenceStatus,
        description: descriptionColumn,
        ownerRequirements: ownerRequirementsColumn,
        pbmColumns,
        pinballmapIcIntent: icIntent.value,
        iscoredGameId,
        promoteGuest: {
          userId: forcePromoteUserId,
          type: targetActive ? "active" : "invited",
        },
      });

      after(() => dispatchNotification(deliveryPlan));

      revalidatePath("/m");
      return ok({
        machineId: machine.id,
        redirectTo: await applyPinballmapAfterCreate(
          machine,
          addToPinballmapAfterCreate
        ),
      });
    } catch (error: unknown) {
      // `initials` is the only unique constraint create can violate. The other
      // one — `machines_pinballmap_listed_unique` — is partial, indexing only
      // rows `WHERE pinballmap_listed`, and create always writes that column
      // false: it is not accepted from the form (PP-o355.29) and no PBM call
      // happens here. An unindexed row cannot collide, so there is nothing to
      // disambiguate and a bare 23505 is unambiguous.
      if (isPgErrorCode(error, "23505")) {
        return err("VALIDATION", `Initials '${initials}' are already taken.`);
      }
      return serverActionError(
        error,
        "SERVER",
        "Failed to create machine. Please try again.",
        { action: "createMachineAction (forcePromote)" }
      );
    }
  }

  // Resolve owner type
  let finalOwnerId: string | undefined = undefined;
  let finalInvitedOwnerId: string | undefined = undefined;

  if (ownerId) {
    const activeOwner = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, ownerId),
    });
    if (activeOwner) {
      // Validate assignee is not a guest
      // permissions-audit-allow: business-logic data validation, not a permission gate
      if (activeOwner.role === "guest") {
        return err(
          "ASSIGNEE_NOT_MEMBER",
          "Selected owner is a guest and must be promoted to member first.",
          {
            assignee: {
              id: activeOwner.id,
              name: activeOwner.name,
              role: "guest",
              type: "active",
            },
          }
        );
      }
      finalOwnerId = ownerId;
    } else {
      // Verify the ID exists in invited_users before assigning
      const invitedOwner = await db.query.invitedUsers.findFirst({
        where: eq(invitedUsers.id, ownerId),
      });
      if (!invitedOwner) {
        return err("VALIDATION", "Selected owner does not exist.");
      }
      // Validate invited assignee is not a guest
      // permissions-audit-allow: business-logic data validation, not a permission gate
      if (invitedOwner.role === "guest") {
        return err(
          "ASSIGNEE_NOT_MEMBER",
          "Selected owner is a guest and must be promoted to member first.",
          {
            assignee: {
              id: invitedOwner.id,
              name: invitedOwner.name,
              role: "guest",
              type: "invited",
            },
          }
        );
      }
      finalInvitedOwnerId = ownerId;
    }
  }
  // If no ownerId provided, leave both undefined — DB stores NULL (no defaulting to caller)

  // Insert machine + watcher + lifecycle events atomically (delegated to the
  // service). No owner promotion here, so the returned plan carries no
  // deliveries — creating a machine with an existing member as owner does not
  // notify them, matching the original.
  try {
    const { machine } = await createMachine({
      name,
      initials,
      actorUserId: user.id,
      ownerId: finalOwnerId,
      invitedOwnerId: finalInvitedOwnerId,
      presenceStatus,
      description: descriptionColumn,
      ownerRequirements: ownerRequirementsColumn,
      pbmColumns,
      pinballmapIcIntent: icIntent.value,
      iscoredGameId,
    });

    revalidatePath("/m");

    return ok({
      machineId: machine.id,
      redirectTo: await applyPinballmapAfterCreate(
        machine,
        addToPinballmapAfterCreate
      ),
    });
  } catch (error: unknown) {
    // Initials is the only unique constraint reachable here — see the
    // forcePromote catch above.
    if (isPgErrorCode(error, "23505")) {
      return err("VALIDATION", `Initials '${initials}' are already taken.`);
    }

    return serverActionError(
      error,
      "SERVER",
      "Failed to create machine. Please try again.",
      { action: "createMachineAction" }
    );
  }
}

/** What a prose form field is called in its error messages. */
const PROSE_FIELD_LABEL: Record<"description" | "ownerRequirements", string> = {
  description: "Description",
  ownerRequirements: "Owner's Requirements",
};

/**
 * Parse an optional machine prose column — `description` or
 * `ownerRequirements` — carried by the machine form as a serialized
 * ProseMirror doc (same hidden-field + JSON pattern as the report form).
 * Presence of the field is the marker: absent → leave the column untouched;
 * empty (or semantically-empty) → clear to null; otherwise the validated doc.
 * Size caps match the inline-edit path (`updateMachineTextField`): 10k
 * plaintext / 100k serialized JSON.
 */
function parseProseFormField(
  formData: FormData,
  field: "description" | "ownerRequirements"
):
  | { ok: true; value: ProseMirrorDoc | null | undefined }
  | { ok: false; message: string } {
  const label = PROSE_FIELD_LABEL[field];
  const raw = formData.get(field);
  // Field absent — this edit surface doesn't own the column.
  if (raw === null) {
    return { ok: true, value: undefined };
  }
  // A non-string value (a File from a malformed/malicious multipart submission)
  // is never a legitimate payload — reject it rather than silently clearing the
  // column. An empty string is the intended "clear to null" signal: the hidden
  // field submits "" when the editor is empty.
  if (typeof raw !== "string") {
    return { ok: false, message: `Invalid ${label} format.` };
  }
  if (raw.length === 0) {
    return { ok: true, value: null };
  }
  // Enforce the serialized-JSON size cap on the raw string BEFORE parsing, so an
  // oversized untrusted payload is rejected without running JSON.parse over it.
  // (validateProseMirrorDoc re-checks the cap for the inline-edit path, which
  // receives an already-parsed doc rather than a raw string.)
  if (raw.length > 100_000) {
    return { ok: false, message: `${label} is too long.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: `Invalid ${label} format.` };
  }
  const result = validateProseMirrorDoc(parsed);
  if (result.status === "invalid") {
    return { ok: false, message: `Invalid ${label} format.` };
  }
  if (result.status === "too-long") {
    return { ok: false, message: `${label} is too long.` };
  }
  // Normalize a whitespace-only doc to null so the DB stores NULL rather than a
  // semantically-empty JSON blob.
  if (result.status === "empty") {
    return { ok: true, value: null };
  }
  return { ok: true, value: result.doc };
}

/**
 * Update Machine Action
 *
 * Updates a machine's name, availability, owner, PinballMap link, and
 * description.
 * Requires authentication.
 *
 * @param _prevState - The previous state of the form.
 * @param formData - The form data.
 * @returns The result of the action.
 */
export async function updateMachineAction(
  _prevState: UpdateMachineResult | undefined,
  formData: FormData
): Promise<UpdateMachineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Fetch user profile to check role
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile) {
    return err("UNAUTHORIZED", "User profile not found.");
  }

  const accessLevel = getAccessLevel(profile.role);

  const rawData = {
    id: formData.get("id"),
    // A missing field reads as `null`, which the optional schema would reject —
    // normalize so "field absent" means "leave the name alone".
    name: formData.get("name") ?? undefined,
    ownerId:
      typeof formData.get("ownerId") === "string" &&
      (formData.get("ownerId") as string).length > 0
        ? (formData.get("ownerId") as string)
        : undefined,
    presenceStatus:
      typeof formData.get("presenceStatus") === "string" &&
      (formData.get("presenceStatus") as string).length > 0
        ? (formData.get("presenceStatus") as string)
        : undefined,
    forcePromoteUserId:
      typeof formData.get("forcePromoteUserId") === "string" &&
      (formData.get("forcePromoteUserId") as string).length > 0
        ? (formData.get("forcePromoteUserId") as string)
        : undefined,
    iscoredGameId: (() => {
      if (!formData.has("iscoredGameId")) return undefined;
      const raw = formData.get("iscoredGameId");
      if (typeof raw === "string" && raw.trim().length > 0) {
        return raw.trim();
      }
      return null;
    })(),
    ...readPbmLinkFormFields(formData),
  };

  // Only the form that renders the PBM picker carries this marker; other edit
  // surfaces (e.g. inline field saves) omit it so they never touch link columns.
  const pbmFormPresent = formData.get("pbmLinkPresent") === "1";

  // Description and Owner's Requirements are carried by the Manage tab's
  // machine form only; `undefined` means "leave the column untouched" so
  // other edit surfaces never clear them.
  const descriptionResult = parseProseFormField(formData, "description");
  if (!descriptionResult.ok) {
    return err("VALIDATION", descriptionResult.message);
  }
  const descriptionColumn = descriptionResult.value;
  const ownerRequirementsResult = parseProseFormField(
    formData,
    "ownerRequirements"
  );
  if (!ownerRequirementsResult.ok) {
    return err("VALIDATION", ownerRequirementsResult.message);
  }
  const ownerRequirementsColumn = ownerRequirementsResult.value;

  const validation = updateMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const {
    id,
    name,
    ownerId,
    presenceStatus,
    forcePromoteUserId,
    iscoredGameId,
  } = validation.data;

  try {
    // Load current machine by id — permission check is authoritative.
    // Pre-load presenceStatus and the joined active-owner display name so
    // lifecycle emits below can compute deltas without re-fetching.
    const currentMachine = await db.query.machines.findFirst({
      where: eq(machines.id, id),
      columns: {
        id: true,
        ownerId: true,
        invitedOwnerId: true,
        name: true,
        initials: true,
        presenceStatus: true,
        // Needed to decide whether an edit re-targets the PBM link — see the
        // intent carry-over at the `resolvePbmLinkColumnsForUpdate` call.
        pinballmapMachineId: true,
        pinballmapIntent: true,
        // Compared against the submitted values so an unchanged save neither
        // rewrites them nor puts an "owner's requirements updated" row on the
        // timeline.
        description: true,
        ownerRequirements: true,
      },
    });

    if (!currentMachine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    // The same marker event the inline editor emits, and on the same rule:
    // only when the normalized value actually changed (PP-0x98). A prose
    // field that did not change is left out of the write, so a stale stored
    // mention label stays as the fallback rather than counting as an edit.
    const ownerRequirementsChanged =
      ownerRequirementsColumn !== undefined &&
      proseChanged(currentMachine.ownerRequirements, ownerRequirementsColumn);
    const descriptionWrite =
      descriptionColumn !== undefined &&
      proseChanged(currentMachine.description, descriptionColumn)
        ? descriptionColumn
        : undefined;
    const ownerRequirementsWrite = ownerRequirementsChanged
      ? ownerRequirementsColumn
      : undefined;

    // Permission check via matrix
    if (
      !checkPermission("machines.edit", accessLevel, {
        userId: user.id,
        machineOwnerId: currentMachine.ownerId,
      })
    ) {
      return err(
        "UNAUTHORIZED",
        "You do not have permission to edit this machine."
      );
    }

    // Plan the PinballMap link change when the picker is on this form. The
    // submitted state is authoritative (clearing it unlinks), so it requires the
    // link permission; the plan derives metadata from the catalog mirror, owns
    // the listing carry-over, and decides any auto-link (PP-o355.20). When the
    // marker is absent, link columns are left untouched.
    //
    // Same seam as the MCP `update_machine` tool — the carry-over rule,
    // the abandonment record and the auto-link choice exist once, in
    // `~/services/machines` (PP-u4ab.12).
    let pbmPlan: MachinePbmLinkPlan | null = null;
    if (pbmFormPresent) {
      if (
        !checkPermission("machines.pinballmap.link", accessLevel, {
          userId: user.id,
          machineOwnerId: currentMachine.ownerId,
        })
      ) {
        return err(
          "UNAUTHORIZED",
          "You do not have permission to link this machine to Pinball Map."
        );
      }
      // Listing intent is not an input to this action at all: the edit form
      // renders no control for it here, `readPbmLinkFormFields` does not read
      // it, and `updateMachineSchema` does not accept it (PP-o355.29). The
      // planner takes the STORED row and owns the carry-over decision, so no
      // caller can take a machine off the lineup by leaving an argument out
      // (PP-l81u).
      const planned = await planMachinePbmLink({
        machineId: id,
        // The form posts every excluded column it owns, so a blank one is a
        // human clearing the box. The reason has no control here at all
        // (PP-3bbr.3), so it is carried from the transaction-locked row below;
        // doing that from this preflight read would race an MCP reason update.
        selection: validation.data,
        stored: {
          pinballmapMachineId: currentMachine.pinballmapMachineId,
          pinballmapIntent: currentMachine.pinballmapIntent,
        },
        // The prospective row: an edit can change availability in the same
        // submit.
        presenceStatus: presenceStatus ?? currentMachine.presenceStatus,
      });
      if (!planned.ok) return err("VALIDATION", planned.message);
      pbmPlan = planned.plan;
    }

    // Handle forcePromoteUserId path
    if (forcePromoteUserId !== undefined) {
      if (!checkPermission("admin.users.promote.guestToMember", accessLevel)) {
        return err(
          "UNAUTHORIZED",
          "You do not have permission to promote users."
        );
      }
      if (forcePromoteUserId !== ownerId) {
        return err(
          "VALIDATION",
          "forcePromoteUserId must match the selected owner."
        );
      }
      // Verify target user exists and is a guest
      const targetActive = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, forcePromoteUserId),
      });
      const targetInvited = targetActive
        ? null
        : await db.query.invitedUsers.findFirst({
            where: eq(invitedUsers.id, forcePromoteUserId),
          });
      if (!targetActive && !targetInvited) {
        return err("VALIDATION", "Selected user does not exist.");
      }
      // permissions-audit-allow: business-logic pre-condition for promotion, not a permission gate
      if ((targetActive?.role ?? targetInvited?.role) !== "guest") {
        return err("VALIDATION", "Selected user is not a guest.");
      }

      const machineOwnerId = targetActive ? forcePromoteUserId : undefined;
      const machineInvitedOwnerId = targetInvited
        ? forcePromoteUserId
        : undefined;
      const oldOwnerId = currentMachine.ownerId;

      // Atomic: promote + update machine + update watcher
      const { machine, ownerEventId } = await db.transaction(async (tx) => {
        // Promote guest to member
        if (targetActive) {
          await tx
            .update(userProfiles)
            .set({ role: "member" })
            .where(eq(userProfiles.id, forcePromoteUserId));
        } else {
          await tx
            .update(invitedUsers)
            .set({ role: "member" })
            .where(eq(invitedUsers.id, forcePromoteUserId));
        }

        // Update machine
        const [updatedMachine] = await tx
          .update(machines)
          .set({
            ...(name !== undefined && { name }),
            ...(presenceStatus !== undefined && { presenceStatus }),
            ownerId: machineOwnerId ?? null,
            invitedOwnerId: machineInvitedOwnerId ?? null,
            ...(descriptionWrite !== undefined && {
              description: descriptionWrite,
            }),
            ...(ownerRequirementsWrite !== undefined && {
              ownerRequirements: ownerRequirementsWrite,
            }),
            ...(iscoredGameId !== undefined && { iscoredGameId }),
          })
          .where(eq(machines.id, id))
          .returning();

        if (!updatedMachine) {
          throw new Error("Machine update failed");
        }

        if (ownerRequirementsChanged) {
          await emitOwnerRequirementsUpdated(tx, id, user.id);
        }

        if (pbmPlan) {
          const selectionWithFreshReason = carryExcludedReason(
            validation.data,
            {
              pinballmapExcluded: updatedMachine.pinballmapExcluded,
              pinballmapExcludedReason: updatedMachine.pinballmapExcludedReason,
            }
          );
          await applyMachinePbmLink(
            tx,
            id,
            {
              ...pbmPlan,
              columns: {
                ...pbmPlan.columns,
                pinballmapExcludedReason:
                  selectionWithFreshReason.pinballmapExcludedReason ?? null,
              },
            },
            user.id,
            updatedMachine.pinballmapIntent
          );
        }

        // Add new owner as watcher if active user
        if (machineOwnerId) {
          await tx
            .insert(machineWatchers)
            .values({
              machineId: id,
              userId: machineOwnerId,
              watchMode: "subscribe",
            })
            .onConflictDoUpdate({
              target: [machineWatchers.machineId, machineWatchers.userId],
              set: { watchMode: "subscribe" },
            });
        }

        // Lifecycle: emit one event per tracked field that changed.
        // Atomic with the update — if an emit fails, the update rolls back.
        const ownerEventId = await emitMachineUpdated(
          tx,
          {
            id: currentMachine.id,
            name: currentMachine.name,
            owner: toMachineOwnerRef(
              currentMachine.ownerId,
              currentMachine.invitedOwnerId
            ),
            presenceStatus: currentMachine.presenceStatus,
          },
          {
            name: name ?? currentMachine.name,
            ownerChanged: true,
            owner: toMachineOwnerRef(machineOwnerId, machineInvitedOwnerId),
            presenceStatus,
          },
          user.id
        );

        if (oldOwnerId !== (machineOwnerId ?? null) && !ownerEventId) {
          throw new Error("Owner changed without a timeline event");
        }

        return { machine: updatedMachine, ownerEventId };
      });

      // Post-commit side effects — best-effort: do not fail the action on notification errors
      try {
        // Resolve channels once for all notifications in this block (PP-rfc).
        const channels = await getChannels();

        // Remove old owner watcher and notify them
        if (ownerEventId && oldOwnerId && oldOwnerId !== machineOwnerId) {
          await db
            .delete(machineWatchers)
            .where(
              and(
                eq(machineWatchers.machineId, id),
                eq(machineWatchers.userId, oldOwnerId)
              )
            );
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                eventId: ownerEventId,
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                ownershipChange: "removed",
                additionalRecipientIds: [oldOwnerId],
              },
              undefined,
              channels
            )
          );
        }

        // Notify new owner
        if (ownerEventId && machineOwnerId && machineOwnerId !== oldOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                eventId: ownerEventId,
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                ownershipChange: "added",
                additionalRecipientIds: [machineOwnerId],
              },
              undefined,
              channels
            )
          );
        }
      } catch (sideEffectError: unknown) {
        reportError(sideEffectError, {
          action: "updateMachineNotifyForcePromote",
          bestEffort: true,
          machineId: machine.id,
        });
      }

      revalidatePath("/m");
      revalidatePath(`/m/${machine.initials}`);
      revalidatePath(`/m/${machine.initials}/edit`);

      return ok({ machineId: machine.id });
    }

    // Resolve owner type if provided (non-forcePromote path)
    let finalOwnerId: string | null | undefined = undefined;
    let finalInvitedOwnerId: string | null | undefined = undefined;
    let shouldUpdateOwner = false;

    if (ownerId) {
      shouldUpdateOwner = true;
      const activeOwner = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, ownerId),
      });
      if (activeOwner) {
        // Validate assignee is not a guest
        // permissions-audit-allow: business-logic data validation, not a permission gate
        if (activeOwner.role === "guest") {
          return err(
            "ASSIGNEE_NOT_MEMBER",
            "Selected owner is a guest and must be promoted to member first.",
            {
              assignee: {
                id: activeOwner.id,
                name: activeOwner.name,
                role: "guest",
                type: "active",
              },
            }
          );
        }
        finalOwnerId = ownerId;
        finalInvitedOwnerId = null; // Reset invited if setting active
      } else {
        // Verify the ID exists in invited_users before assigning
        const invitedOwner = await db.query.invitedUsers.findFirst({
          where: eq(invitedUsers.id, ownerId),
        });
        if (!invitedOwner) {
          return err("VALIDATION", "Selected owner does not exist.");
        }
        // Validate invited assignee is not a guest
        // permissions-audit-allow: business-logic data validation, not a permission gate
        if (invitedOwner.role === "guest") {
          return err(
            "ASSIGNEE_NOT_MEMBER",
            "Selected owner is a guest and must be promoted to member first.",
            {
              assignee: {
                id: invitedOwner.id,
                name: invitedOwner.name,
                role: "guest",
                type: "invited",
              },
            }
          );
        }
        finalInvitedOwnerId = ownerId;
        finalOwnerId = null; // Reset active if setting invited
      }
    }

    const oldOwnerId = currentMachine.ownerId;

    // Every non-PinballMap column this submit touches. Each edit surface posts
    // only the fields it renders, so this is routinely a subset — and on the PBM
    // picker's own save it is EMPTY, which is why it cannot go straight into a
    // `.set()`: Drizzle rejects an update with no values, and the link columns
    // now travel separately (`applyMachinePbmLink`).
    const detailValues = {
      ...(name !== undefined && { name }),
      ...(presenceStatus !== undefined && { presenceStatus }),
      ...(shouldUpdateOwner && {
        ownerId: finalOwnerId,
        invitedOwnerId: finalInvitedOwnerId,
      }),
      ...(descriptionWrite !== undefined && {
        description: descriptionWrite,
      }),
      ...(ownerRequirementsWrite !== undefined && {
        ownerRequirements: ownerRequirementsWrite,
      }),
      ...(iscoredGameId !== undefined && { iscoredGameId }),
    };

    // Atomic: update machine + reconcile watcher rows + emit lifecycle events.
    // Notifications stay outside the tx as best-effort side effects.
    const { machine, ownerEventId } = await db.transaction(async (tx) => {
      const [updatedMachine] =
        Object.keys(detailValues).length > 0
          ? await tx
              .update(machines)
              .set(detailValues)
              .where(eq(machines.id, id))
              .returning()
          : // Nothing outside the PBM block changed. Read the row instead of
            // writing it, so the NOT_FOUND check below still runs and the
            // caller still gets a machine back.
            await tx
              .select()
              .from(machines)
              .where(eq(machines.id, id))
              .for("update")
              .limit(1);

      if (!updatedMachine) {
        throw new MachineNotFoundError();
      }

      if (ownerRequirementsChanged) {
        await emitOwnerRequirementsUpdated(tx, id, user.id);
      }

      if (pbmPlan) {
        const selectionWithFreshReason = carryExcludedReason(validation.data, {
          pinballmapExcluded: updatedMachine.pinballmapExcluded,
          pinballmapExcludedReason: updatedMachine.pinballmapExcludedReason,
        });
        await applyMachinePbmLink(
          tx,
          id,
          {
            ...pbmPlan,
            columns: {
              ...pbmPlan.columns,
              pinballmapExcludedReason:
                selectionWithFreshReason.pinballmapExcludedReason ?? null,
            },
          },
          user.id,
          updatedMachine.pinballmapIntent
        );
      }

      // Handle owner changes in machine_watchers (inside tx so they roll back
      // with the update if anything below fails).
      if (shouldUpdateOwner) {
        // 1. Remove old owner from watchers (notification sent post-commit)
        if (oldOwnerId && oldOwnerId !== finalOwnerId) {
          await tx
            .delete(machineWatchers)
            .where(
              and(
                eq(machineWatchers.machineId, id),
                eq(machineWatchers.userId, oldOwnerId)
              )
            );
        }

        // 2. Add new owner as subscriber (notification sent post-commit)
        if (finalOwnerId && finalOwnerId !== oldOwnerId) {
          await tx
            .insert(machineWatchers)
            .values({
              machineId: id,
              userId: finalOwnerId,
              watchMode: "subscribe",
            })
            .onConflictDoUpdate({
              target: [machineWatchers.machineId, machineWatchers.userId],
              set: { watchMode: "subscribe" },
            });
        }
      }

      // Lifecycle: emit one event per tracked field that changed.
      // Atomic with the update — if an emit fails, the update rolls back.
      const ownerEventId = await emitMachineUpdated(
        tx,
        {
          id: currentMachine.id,
          name: currentMachine.name,
          owner: toMachineOwnerRef(
            currentMachine.ownerId,
            currentMachine.invitedOwnerId
          ),
          presenceStatus: currentMachine.presenceStatus,
        },
        {
          name: name ?? currentMachine.name,
          ownerChanged: shouldUpdateOwner,
          owner: toMachineOwnerRef(finalOwnerId, finalInvitedOwnerId),
          presenceStatus,
        },
        user.id
      );

      if (
        shouldUpdateOwner &&
        oldOwnerId !== (finalOwnerId ?? null) &&
        !ownerEventId
      ) {
        throw new Error("Owner changed without a timeline event");
      }

      return { machine: updatedMachine, ownerEventId };
    });

    // Post-commit side effects — best-effort: do not fail the action on notification errors
    if (shouldUpdateOwner) {
      try {
        // Resolve channels once for all notifications in this block (PP-rfc).
        const channels = await getChannels();

        if (ownerEventId && oldOwnerId && oldOwnerId !== finalOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                eventId: ownerEventId,
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                ownershipChange: "removed",
                additionalRecipientIds: [oldOwnerId],
              },
              undefined,
              channels
            )
          );
        }
        if (ownerEventId && finalOwnerId && finalOwnerId !== oldOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                eventId: ownerEventId,
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                ownershipChange: "added",
                additionalRecipientIds: [finalOwnerId],
              },
              undefined,
              channels
            )
          );
        }
      } catch (sideEffectError: unknown) {
        reportError(sideEffectError, {
          action: "updateMachineNotify",
          bestEffort: true,
          machineId: machine.id,
        });
      }
    }

    revalidatePath("/m");
    revalidatePath(`/m/${machine.initials}`);
    revalidatePath(`/m/${machine.initials}/edit`);

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof MachineNotFoundError) {
      return err("NOT_FOUND", "Machine not found.");
    }
    // No listing-collision branch here, and none is possible: the one-lister
    // unique index went with the coverage model (PP-o355.21), and nothing in
    // this action writes listing intent except the carry-over, which only ever
    // preserves or clears what the row already held.
    return serverActionError(
      error,
      "SERVER",
      "Failed to update machine. Please try again.",
      { action: "updateMachineAction" }
    );
  }
}

/**
 * Delete Machine Action
 *
 * Deletes a machine.
 * Requires authentication.
 *
 * @param _prevState - The previous state of the form.
 * @param formData - The form data.
 * @returns The result of the action.
 */
export async function deleteMachineAction(
  _prevState: DeleteMachineResult | undefined,
  formData: FormData
): Promise<DeleteMachineResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  const validation = deleteMachineSchema.safeParse({
    id: formData.get("id"),
  });
  if (!validation.success) {
    return err(
      "VALIDATION",
      validation.error.issues[0]?.message ?? "Invalid input"
    );
  }

  const { id: machineId } = validation.data;

  try {
    const machine = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      columns: { id: true, ownerId: true },
    });

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    const accessLevel = await getUserAccessLevel(user.id);
    const deletePermission = getPermission("machines.delete", accessLevel);
    if (
      !checkPermission("machines.delete", accessLevel, {
        userId: user.id,
        machineOwnerId: machine.ownerId,
      })
    ) {
      return err(
        "FORBIDDEN",
        "You do not have permission to delete this machine."
      );
    }
    if (accessLevel === "unauthenticated") {
      return err(
        "FORBIDDEN",
        "You do not have permission to delete this machine."
      );
    }

    const currentAccessLevel = exists(
      db
        .select({ id: userProfiles.id })
        .from(userProfiles)
        .where(
          and(eq(userProfiles.id, user.id), eq(userProfiles.role, accessLevel))
        )
    );
    const deleteAuthorization =
      deletePermission === true
        ? currentAccessLevel
        : and(currentAccessLevel, eq(machines.ownerId, user.id));

    const [deletedMachine] = await db
      .delete(machines)
      .where(and(eq(machines.id, machineId), deleteAuthorization))
      .returning({ id: machines.id });

    if (!deletedMachine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    revalidatePath("/m");

    return ok({ machineId });
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "Failed to delete machine. Please try again.",
      { action: "deleteMachineAction" }
    );
  }
}

// --- Machine Text Field Update Actions ---

export type UpdateMachineFieldResult = Result<
  { machineId: string },
  "VALIDATION" | "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

/**
 * Update Machine Description
 *
 * Editable by machine owner and admins.
 */
export async function updateMachineDescription(
  machineId: string,
  value: ProseMirrorDoc | null
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "description");
}

/**
 * Update Machine Owner Requirements
 *
 * Editable by machine owner and admins.
 */
export async function updateMachineOwnerRequirements(
  machineId: string,
  value: ProseMirrorDoc | null
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "ownerRequirements");
}

/**
 * Internal helper for updating a machine text field.
 *
 * Permission logic:
 * - description, ownerRequirements: owner + tech + admins
 */
async function updateMachineTextField(
  machineId: string,
  value: ProseMirrorDoc | null,
  field: "description" | "ownerRequirements"
): Promise<UpdateMachineFieldResult> {
  // Auth check (CORE-SEC-001)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  // Simple validation for machineId
  if (!z.string().uuid().safeParse(machineId).success) {
    return err("VALIDATION", "Invalid machine ID");
  }

  // Validate ProseMirror payload: must be null or a well-formed doc with type:"doc".
  // Normalize empty docs to null so the DB stores NULL rather than a semantically-empty JSON blob.
  let normalizedValue: ProseMirrorDoc | null = value;
  if (value !== null) {
    const result = validateProseMirrorDoc(value);
    if (result.status === "invalid") {
      return err("VALIDATION", "Invalid rich text payload.");
    }
    if (result.status === "too-long") {
      return err("VALIDATION", "Text is too long.");
    }
    if (result.status === "empty") {
      normalizedValue = null;
    }
  }

  try {
    // Fetch user profile and machine in parallel
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      // Load the full machine row (rather than `columns: {...}`) so the
      // current value of the prose field being edited is available for the
      // before/after diff in the marker-event emit below. Using a dynamic
      // `[field]: true` column projection would erase Drizzle's static type
      // inference and force unsafe casts on every property access.
      db.query.machines.findFirst({
        where: eq(machines.id, machineId),
      }),
    ]);

    if (!profile) {
      return err("UNAUTHORIZED", "User profile not found.");
    }

    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    const accessLevel = getAccessLevel(profile.role);
    const ctx = { userId: user.id, machineOwnerId: machine.ownerId };

    // Permission check via matrix
    const permissionId = "machines.edit";
    if (!checkPermission(permissionId, accessLevel, ctx)) {
      return err(
        "UNAUTHORIZED",
        "Only the machine owner, technicians, or admins can edit this field."
      );
    }

    // Compute change diff for the marker event. Compare the *normalized* value
    // (post empty-doc → null normalization) against the stored value so that
    // pure-whitespace edits collapse to no-ops and don't spam the timeline.
    //
    // Use a canonical (sorted-keys) JSON serializer because PostgreSQL JSONB
    // doesn't preserve source key order — a round-tripped doc returns with
    // PG's normalized key order which won't match the client's submission
    // order under plain `JSON.stringify`.
    //
    // Mention labels are ignored (`proseChanged`): the editor opens on the
    // current names, so an untouched save after a rename is not an edit, and
    // is not written either.
    const beforeValue: ProseMirrorDoc | null = machine[field];
    const changed = proseChanged(beforeValue, normalizedValue);

    if (!changed) return ok({ machineId: machine.id });

    // Atomic: update + (optional) marker event emit. If the emit fails, the
    // field update rolls back along with it.
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ [field]: normalizedValue })
        .where(eq(machines.id, machine.id));

      // Only emit when the field has an event-kind mapping. `description` is
      // intentionally omitted from the map (see PROSE_FIELD_TO_EVENT_KIND).
      const eventKind = PROSE_FIELD_TO_EVENT_KIND[field];
      if (eventKind) {
        await createMachineTimelineEvent(
          machine.id,
          {
            sourceType: "lifecycle",
            tag: "lifecycle",
            eventData: { kind: eventKind },
            actorId: user.id,
          },
          tx
        );
      }
    });

    revalidatePath(`/m/${machine.initials}`);

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return serverActionError(
      error,
      "SERVER",
      "Failed to update field. Please try again.",
      { action: "updateMachineTextField", field }
    );
  }
}

// --- Machine Presence (availability) Update Action ---

const presenceSchema = z.enum(VALID_MACHINE_PRESENCE_STATUSES);

/**
 * Update Machine Presence (availability) — the one manual machine control on
 * the Service tab (design §4). Status stays read-only/derived; presence is a
 * 5-state select. Editable by machine owner, technicians, and admins
 * (`machines.edit`).
 *
 * Emits a `presence_changed` lifecycle event (via {@link emitMachineUpdated})
 * atomically with the row update, so the change surfaces in the Activity feed.
 * The emit only fires when the value actually changes.
 */
export async function updateMachinePresenceAction(
  machineId: string,
  presenceStatus: MachinePresenceStatus
): Promise<UpdateMachineFieldResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized. Please log in.");
  }

  if (!z.string().uuid().safeParse(machineId).success) {
    return err("VALIDATION", "Invalid machine ID");
  }

  const parsedPresence = presenceSchema.safeParse(presenceStatus);
  if (!parsedPresence.success) {
    return err("VALIDATION", "Invalid availability value.");
  }

  try {
    const [profile, machine] = await Promise.all([
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      }),
      db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: {
          id: true,
          initials: true,
          name: true,
          ownerId: true,
          invitedOwnerId: true,
          presenceStatus: true,
        },
      }),
    ]);

    if (!profile) {
      return err("UNAUTHORIZED", "User profile not found.");
    }
    if (!machine) {
      return err("NOT_FOUND", "Machine not found.");
    }

    const accessLevel = getAccessLevel(profile.role);
    if (
      !checkPermission("machines.edit", accessLevel, {
        userId: user.id,
        machineOwnerId: machine.ownerId,
      })
    ) {
      return err(
        "UNAUTHORIZED",
        "Only the machine owner, technicians, or admins can change availability."
      );
    }

    // Delegate the mutation to the service, which owns the transaction + the
    // `presence_changed` lifecycle emit and the unchanged-value no-op guard
    // (skips the write entirely — no bumped `updatedAt`, no timeline row).
    const { changed } = await updateMachinePresence({
      machineId: machine.id,
      presenceStatus: parsedPresence.data,
      actorUserId: user.id,
      current: {
        name: machine.name,
        ownerId: machine.ownerId,
        invitedOwnerId: machine.invitedOwnerId,
        presenceStatus: machine.presenceStatus,
      },
    });

    if (changed) {
      // Presence shows on both the Info and Service tabs (and the header), and a
      // change emits a timeline row — revalidate the whole machine subtree.
      revalidatePath(`/m/${machine.initials}`, "layout");
    }

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    return serverActionError(
      error,
      "SERVER",
      "Failed to update availability. Please try again.",
      { action: "updateMachinePresenceAction" }
    );
  }
}
