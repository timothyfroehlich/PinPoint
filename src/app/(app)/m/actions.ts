/**
 * Machine Server Actions
 *
 * Server-side mutations for machine CRUD operations.
 * All actions require authentication (CORE-SEC-001).
 */

"use server";

import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  machines,
  machineWatchers,
  userProfiles,
  invitedUsers,
  pinballmapCatalog,
} from "~/server/db/schema";
import { createMachineSchema, updateMachineSchema } from "./schemas";
import { validatePbmLinkSelection } from "~/lib/pinballmap/linking";
import { type Result, ok, err } from "~/lib/result";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
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
import {
  type ProseMirrorDoc,
  docToPlainText,
  proseMirrorDocSchema,
} from "~/lib/tiptap/types";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { isPgErrorCode } from "~/lib/db/postgres-errors";
import {
  emitMachineCreated,
  emitMachineUpdated,
  toMachineOwnerRef,
} from "~/lib/timeline/machine-lifecycle-helpers";
import { createMachineTimelineEvent } from "~/lib/timeline/machine-events";
import { type MachineTimelineEventKind } from "~/lib/timeline/machine-event-types";

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
type ProseFieldEventKind = "owner_requirements_updated" | "owner_notes_updated";

const PROSE_FIELD_TO_EVENT_KIND: Partial<
  Record<
    "description" | "ownerRequirements" | "ownerNotes",
    ProseFieldEventKind
  >
> = {
  ownerRequirements: "owner_requirements_updated",
  ownerNotes: "owner_notes_updated",
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
  "UNAUTHORIZED" | "NOT_FOUND" | "SERVER"
>;

/** Machine columns derived from a create/edit form's PinballMap link selection. */
interface PbmLinkColumns {
  pinballmapMachineId: number | null;
  pinballmapExcluded: boolean;
  pinballmapExcludedReason: string | null;
  manufacturer: string | null;
  year: number | null;
  opdbId: string | null;
  ipdbId: number | null;
}

type ResolvePbmLinkResult =
  | { ok: true; columns: PbmLinkColumns }
  | { ok: false; message: string };

/**
 * Resolve the machine's PinballMap columns from the submitted link selection.
 *
 * Enforces the mutual-exclusion + (flag-gated) requirement via
 * {@link validatePbmLinkSelection}, and — crucially — derives model metadata
 * (manufacturer/year/OPDB/IPDB) from the catalog mirror rather than trusting the
 * client. Returns the full column set so both the create and edit inserts/updates
 * can spread it; the submitted state is authoritative (clearing the picker
 * unlinks, which is how re-link/unlink works).
 */
async function resolvePbmLinkColumns(input: {
  pinballmapMachineId?: number | undefined;
  pinballmapExcluded?: boolean | undefined;
  pinballmapExcludedReason?: string | undefined;
}): Promise<ResolvePbmLinkResult> {
  const pinballmapMachineId = input.pinballmapMachineId ?? null;
  const pinballmapExcluded = input.pinballmapExcluded ?? false;

  const validationError = validatePbmLinkSelection({
    pinballmapMachineId,
    pinballmapExcluded,
  });
  if (validationError === "both_link_and_excluded") {
    return {
      ok: false,
      message:
        "A machine can't be both linked to PinballMap and marked as not on it.",
    };
  }
  if (validationError === "link_required") {
    return {
      ok: false,
      message:
        "Select a PinballMap title or mark the machine as not on PinballMap.",
    };
  }

  const empty: PbmLinkColumns = {
    pinballmapMachineId: null,
    pinballmapExcluded: false,
    pinballmapExcludedReason: null,
    manufacturer: null,
    year: null,
    opdbId: null,
    ipdbId: null,
  };

  if (pinballmapExcluded) {
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapExcluded: true,
        pinballmapExcludedReason: input.pinballmapExcludedReason ?? null,
      },
    };
  }

  if (pinballmapMachineId !== null) {
    const entry = await db.query.pinballmapCatalog.findFirst({
      where: eq(pinballmapCatalog.pinballmapMachineId, pinballmapMachineId),
    });
    if (!entry) {
      return {
        ok: false,
        message:
          "That PinballMap title is no longer in the catalog — search again.",
      };
    }
    return {
      ok: true,
      columns: {
        ...empty,
        pinballmapMachineId,
        manufacturer: entry.manufacturer,
        year: entry.year,
        opdbId: entry.opdbId,
        ipdbId: entry.ipdbId,
      },
    };
  }

  // Neither linked nor excluded (requirement off): all PBM columns stay empty.
  return { ok: true, columns: empty };
}

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
 */
function readPbmLinkFormFields(formData: FormData): {
  pinballmapMachineId: string | undefined;
  pinballmapExcluded: boolean | undefined;
  pinballmapExcludedReason: string | undefined;
} {
  const idRaw = formData.get("pinballmapMachineId");
  const reasonRaw = formData.get("pinballmapExcludedReason");
  return {
    pinballmapMachineId:
      typeof idRaw === "string" && idRaw.length > 0 ? idRaw : undefined,
    pinballmapExcluded:
      formData.get("pinballmapExcluded") === "on" ? true : undefined,
    pinballmapExcludedReason:
      typeof reasonRaw === "string" && reasonRaw.trim().length > 0
        ? reasonRaw
        : undefined,
  };
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
    forcePromoteUserId:
      typeof formData.get("forcePromoteUserId") === "string" &&
      (formData.get("forcePromoteUserId") as string).length > 0
        ? (formData.get("forcePromoteUserId") as string)
        : undefined,
    ...readPbmLinkFormFields(formData),
  };

  // Validate input (CORE-SEC-002)
  const validation = createMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { name, initials, ownerId, forcePromoteUserId } = validation.data;

  // Resolve PinballMap link columns (mutual-exclusion + catalog-derived metadata).
  // Creators are tech/admin (machines.create), who always hold the link
  // permission; the explicit check keeps this honest if that ever changes.
  if (
    wantsPbmLinkChange(validation.data) &&
    !checkPermission("machines.pinballmap.link", accessLevel)
  ) {
    return err(
      "UNAUTHORIZED",
      "You do not have permission to link machines to PinballMap."
    );
  }
  const pbm = await resolvePbmLinkColumns(validation.data);
  if (!pbm.ok) return err("VALIDATION", pbm.message);
  const pbmColumns = pbm.columns;

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

    // Atomic: promote + insert machine + add watcher
    try {
      const [machine] = await db.transaction(async (tx) => {
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

        // Determine owner columns
        const machineOwnerId = targetActive ? forcePromoteUserId : undefined;
        const machineInvitedOwnerId = targetInvited
          ? forcePromoteUserId
          : undefined;

        // Insert machine
        const [newMachine] = await tx
          .insert(machines)
          .values({
            name,
            initials,
            ownerId: machineOwnerId,
            invitedOwnerId: machineInvitedOwnerId,
            ...pbmColumns,
          })
          .returning();

        if (!newMachine) {
          throw new Error("Machine creation failed");
        }

        // Add owner as watcher
        if (machineOwnerId) {
          await tx
            .insert(machineWatchers)
            .values({
              machineId: newMachine.id,
              userId: machineOwnerId,
              watchMode: "subscribe",
            })
            .onConflictDoUpdate({
              target: [machineWatchers.machineId, machineWatchers.userId],
              set: { watchMode: "subscribe" },
            });
        }

        // Lifecycle: emit machine_added (and owner_set with a to_owner
        // person-reference if owned — real OR invited). Atomic with the
        // machine insert — if these fail, the machine rolls back.
        await emitMachineCreated(
          tx,
          {
            id: newMachine.id,
            owner: toMachineOwnerRef(
              newMachine.ownerId,
              newMachine.invitedOwnerId
            ),
          },
          user.id
        );

        return [newMachine];
      });

      // Post-commit side effect — best-effort: do not fail the action on notification errors
      if (targetActive) {
        try {
          const channels = await getChannels();
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                newStatus: "added",
                additionalRecipientIds: [forcePromoteUserId],
              },
              undefined,
              channels
            )
          );
        } catch (sideEffectError: unknown) {
          reportError(sideEffectError, {
            action: "createMachineNotify",
            bestEffort: true,
            machineId: machine.id,
          });
        }
      }

      revalidatePath("/m");
      return ok({
        machineId: machine.id,
        redirectTo: `/m/${machine.initials}`,
      });
    } catch (error: unknown) {
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
              name: `${activeOwner.firstName} ${activeOwner.lastName}`,
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
              name: `${invitedOwner.firstName} ${invitedOwner.lastName}`,
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

  // Insert machine + watcher + lifecycle events atomically.
  try {
    const [machine] = await db.transaction(async (tx) => {
      const [newMachine] = await tx
        .insert(machines)
        .values({
          name,
          initials,
          ownerId: finalOwnerId,
          invitedOwnerId: finalInvitedOwnerId,
          ...pbmColumns,
        })
        .returning();

      if (!newMachine) {
        throw new Error("Machine creation failed");
      }

      // Auto-add owner to machine_watchers (full subscribe mode)
      if (finalOwnerId) {
        await tx
          .insert(machineWatchers)
          .values({
            machineId: newMachine.id,
            userId: finalOwnerId,
            watchMode: "subscribe",
          })
          .onConflictDoUpdate({
            target: [machineWatchers.machineId, machineWatchers.userId],
            set: { watchMode: "subscribe" },
          });
      }

      // Lifecycle: emit machine_added (and owner_set with a to_owner
      // person-reference if owned — real OR invited). Atomic with the machine
      // insert — if these fail, the machine rolls back.
      await emitMachineCreated(
        tx,
        {
          id: newMachine.id,
          owner: toMachineOwnerRef(
            newMachine.ownerId,
            newMachine.invitedOwnerId
          ),
        },
        user.id
      );

      return [newMachine];
    });

    revalidatePath("/m");

    return ok({
      machineId: machine.id,
      redirectTo: `/m/${machine.initials}`,
    });
  } catch (error: unknown) {
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

/**
 * Update Machine Action
 *
 * Updates a machine's name.
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
    name: formData.get("name"),
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
    ...readPbmLinkFormFields(formData),
  };

  // Only the form that renders the PBM picker carries this marker; other edit
  // surfaces (e.g. inline field saves) omit it so they never touch link columns.
  const pbmFormPresent = formData.get("pbmLinkPresent") === "1";

  const validation = updateMachineSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return err("VALIDATION", firstError?.message ?? "Invalid input");
  }

  const { id, name, ownerId, presenceStatus, forcePromoteUserId } =
    validation.data;

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
      },
    });

    if (!currentMachine) {
      return err("NOT_FOUND", "Machine not found.");
    }

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

    // Resolve PinballMap link columns when the picker is on this form. The
    // submitted state is authoritative (clearing it unlinks), so it requires the
    // link permission and derives metadata from the catalog mirror. When the
    // marker is absent, link columns are left untouched.
    let pbmColumns: PbmLinkColumns | null = null;
    if (pbmFormPresent) {
      if (
        !checkPermission("machines.pinballmap.link", accessLevel, {
          userId: user.id,
          machineOwnerId: currentMachine.ownerId,
        })
      ) {
        return err(
          "UNAUTHORIZED",
          "You do not have permission to link this machine to PinballMap."
        );
      }
      const pbm = await resolvePbmLinkColumns(validation.data);
      if (!pbm.ok) return err("VALIDATION", pbm.message);
      pbmColumns = pbm.columns;
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
      const [machine] = await db.transaction(async (tx) => {
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
            name,
            ...(presenceStatus !== undefined && { presenceStatus }),
            ownerId: machineOwnerId ?? null,
            invitedOwnerId: machineInvitedOwnerId ?? null,
            ...(pbmColumns ?? {}),
          })
          .where(eq(machines.id, id))
          .returning();

        if (!updatedMachine) {
          throw new Error("Machine update failed");
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
        await emitMachineUpdated(
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
            name,
            ownerChanged: true,
            owner: toMachineOwnerRef(machineOwnerId, machineInvitedOwnerId),
            presenceStatus,
          },
          user.id
        );

        return [updatedMachine];
      });

      // Post-commit side effects — best-effort: do not fail the action on notification errors
      try {
        // Resolve channels once for all notifications in this block (PP-rfc).
        const channels = await getChannels();

        // Remove old owner watcher and notify them
        if (oldOwnerId && oldOwnerId !== machineOwnerId) {
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
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                newStatus: "removed",
                additionalRecipientIds: [oldOwnerId],
              },
              undefined,
              channels
            )
          );
        }

        // Notify new owner
        if (machineOwnerId && machineOwnerId !== oldOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                newStatus: "added",
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
                name: `${activeOwner.firstName} ${activeOwner.lastName}`,
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
                name: `${invitedOwner.firstName} ${invitedOwner.lastName}`,
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

    // Atomic: update machine + reconcile watcher rows + emit lifecycle events.
    // Notifications stay outside the tx as best-effort side effects.
    const [machine] = await db.transaction(async (tx) => {
      const [updatedMachine] = await tx
        .update(machines)
        .set({
          name,
          ...(presenceStatus !== undefined && { presenceStatus }),
          ...(shouldUpdateOwner && {
            ownerId: finalOwnerId,
            invitedOwnerId: finalInvitedOwnerId,
          }),
          ...(pbmColumns ?? {}),
        })
        .where(eq(machines.id, id))
        .returning();

      if (!updatedMachine) {
        throw new MachineNotFoundError();
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
      await emitMachineUpdated(
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
          name,
          ownerChanged: shouldUpdateOwner,
          owner: toMachineOwnerRef(finalOwnerId, finalInvitedOwnerId),
          presenceStatus,
        },
        user.id
      );

      return [updatedMachine];
    });

    // Post-commit side effects — best-effort: do not fail the action on notification errors
    if (shouldUpdateOwner) {
      try {
        // Resolve channels once for all notifications in this block (PP-rfc).
        const channels = await getChannels();

        if (oldOwnerId && oldOwnerId !== finalOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                newStatus: "removed",
                additionalRecipientIds: [oldOwnerId],
              },
              undefined,
              channels
            )
          );
        }
        if (finalOwnerId && finalOwnerId !== oldOwnerId) {
          await dispatchNotification(
            await planNotification(
              {
                type: "machine_ownership_changed",
                resourceId: machine.id,
                resourceType: "machine",
                actorId: user.id,
                includeActor: false,
                machineName: machine.name,
                newStatus: "added",
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

    return ok({ machineId: machine.id });
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof MachineNotFoundError) {
      return err("NOT_FOUND", "Machine not found.");
    }
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

  const machineId = formData.get("id") as string;

  try {
    const [machine] = await db
      .delete(machines)
      .where(and(eq(machines.id, machineId), eq(machines.ownerId, user.id)))
      .returning();

    if (!machine) {
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
 * Update Machine Owner Notes
 *
 * Editable by machine owner ONLY (not even admins).
 */
export async function updateMachineOwnerNotes(
  machineId: string,
  value: ProseMirrorDoc | null
): Promise<UpdateMachineFieldResult> {
  return updateMachineTextField(machineId, value, "ownerNotes");
}

/**
 * Internal helper for updating a machine text field.
 *
 * Permission logic:
 * - description, ownerRequirements: owner + tech + admins
 * - ownerNotes: owner only (machines.edit.ownerNotes)
 */
async function updateMachineTextField(
  machineId: string,
  value: ProseMirrorDoc | null,
  field: "description" | "ownerRequirements" | "ownerNotes"
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

  // Validate ProseMirror payload: must be null or a well-formed doc with type:"doc"
  // Normalize empty docs to null so the DB stores NULL rather than a semantically-empty JSON blob.
  let normalizedValue: ProseMirrorDoc | null = value;
  if (value !== null) {
    if (!proseMirrorDocSchema.safeParse(value).success) {
      return err("VALIDATION", "Invalid rich text payload.");
    }
    const plainText = docToPlainText(value);
    if (plainText.length > 10_000) {
      return err("VALIDATION", "Text is too long.");
    }
    if (JSON.stringify(value).length > 100_000) {
      return err("VALIDATION", "Text is too long.");
    }
    // Normalize empty doc to null
    if (plainText.trim().length === 0) {
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

    // Permission check via matrix — ownerNotes uses its own permission
    const permissionId =
      field === "ownerNotes" ? "machines.edit.ownerNotes" : "machines.edit";
    if (!checkPermission(permissionId, accessLevel, ctx)) {
      if (field === "ownerNotes") {
        return err(
          "UNAUTHORIZED",
          "Only the machine owner can edit owner notes."
        );
      }
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
    const beforeValue: ProseMirrorDoc | null = machine[field];
    const changed =
      canonicalJson(beforeValue) !== canonicalJson(normalizedValue);

    // Atomic: update + (optional) marker event emit. If the emit fails, the
    // field update rolls back along with it.
    await db.transaction(async (tx) => {
      await tx
        .update(machines)
        .set({ [field]: normalizedValue })
        .where(eq(machines.id, machine.id));

      // Only emit when (a) the field actually changed and (b) the field
      // has an event-kind mapping. `description` is intentionally omitted
      // from the map (see PROSE_FIELD_TO_EVENT_KIND).
      const eventKind = PROSE_FIELD_TO_EVENT_KIND[field];
      if (changed && eventKind) {
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
