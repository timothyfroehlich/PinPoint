import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { IssueStatus } from "~/lib/issues/status";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { McpToolError } from "~/lib/mcp/tools/harness";
import type { PbmIcIntent } from "~/lib/pinballmap/insider-connected";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type {
  IssueFrequency,
  IssuePriority,
  IssueSeverity,
  UserRole,
} from "~/lib/types";
import type { MachinePbmColumns } from "~/services/machines";
import { db } from "~/server/db";
import {
  invitedUsers,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";

const uuidSchema = z.string().uuid();

/**
 * The minimal machine snapshot tools need for permission + service calls.
 *
 * Extends {@link MachinePbmColumns} — the same column set the create/edit paths
 * write — so a resolved machine carries its full PinballMap state. That is what
 * `get_machine` reports (via `buildMachinePinballmap`) and what any future write
 * tool needs to carry `pinballmapIntent` over from the STORED row rather than
 * from its arguments (PP-o355.29).
 */
export interface MachineRef extends MachinePbmColumns {
  id: string;
  initials: string;
  name: string;
  ownerId: string | null;
  invitedOwnerId: string | null;
  presenceStatus: MachinePresenceStatus;
  iscoredGameId: string | null;
  pinballmapIcIntent: PbmIcIntent | null;
}

/**
 * Resolve a machine by its human-friendly initials (case-insensitive) or its
 * UUID. Throws {@link McpToolError} `not_found` when nothing matches.
 */
export async function resolveMachine(ref: string): Promise<MachineRef> {
  const trimmed = ref.trim();
  const byUuid = uuidSchema.safeParse(trimmed).success;
  const machine = await db.query.machines.findFirst({
    where: byUuid
      ? eq(machines.id, trimmed)
      : eq(machines.initials, trimmed.toUpperCase()),
    columns: {
      id: true,
      initials: true,
      name: true,
      ownerId: true,
      invitedOwnerId: true,
      presenceStatus: true,
      pinballmapMachineId: true,
      pinballmapExcluded: true,
      pinballmapExcludedReason: true,
      pinballmapIntent: true,
      modelName: true,
      manufacturer: true,
      year: true,
      type: true,
      display: true,
      playerCount: true,
      designers: true,
      artists: true,
      opdbId: true,
      ipdbId: true,
      iscoredGameId: true,
      pinballmapIcIntent: true,
    },
  });
  if (!machine) {
    throw new McpToolError(
      "not_found",
      `No machine found for "${ref}". Use list_machines to find its initials.`
    );
  }
  return machine;
}

/** The owner columns to write, resolved from a name or UUID (or cleared). */
export interface ResolvedOwner {
  ownerId: string | null;
  invitedOwnerId: string | null;
}

/**
 * A profile matched by name, with the role its caller may or may not gate on.
 *
 * `role` carries the column's own union rather than `string`: this interface is
 * the declared return type of {@link findProfilesByFullName}, so widening it
 * here would widen what Drizzle inferred and let a misspelled comparison
 * (`m.role !== "guests"`) compile into a filter that excludes nobody.
 */
interface NamedProfile {
  id: string;
  name: string;
  role: UserRole;
}

/**
 * Case-insensitive exact match on the full name ("First Last").
 *
 * Matches the generated `name` column rather than rebuilding `first || ' ' ||
 * last` here. Those two stopped being the same string in PP-if48: `name` is
 * `btrim(first_name || ' ' || last_name)`, and a user with no surname — which
 * is now legal, and is what every OAuth fallback produces — concatenates to
 * `"presidentnick "` with a trailing space. Comparing against that would miss
 * exactly the single-name users this whole change exists to make findable.
 * `btrim` on the input for the same reason, from the other side.
 *
 * Capped at 5: the only use for more than one match is naming the candidates in
 * the ambiguity error, and an unbounded fetch would trade a longer message for a
 * bigger query.
 */
function findProfilesByFullName(value: string): Promise<NamedProfile[]> {
  return db.query.userProfiles.findMany({
    where: sql`lower(${userProfiles.name}) = lower(btrim(${value}))`,
    columns: { id: true, name: true, role: true },
    limit: 5,
  });
}

/** Same name, several people — name the candidates so the caller can pick one. */
function ambiguousName(ref: string, matches: NamedProfile[]): McpToolError {
  const candidates = matches.map((m) => `${m.name} (${m.id})`).join(", ");
  return new McpToolError(
    "invalid",
    `Multiple members named "${ref}": ${candidates}. Pass the specific UUID.`
  );
}

/**
 * Resolve an owner argument — a UUID, a full name ("First Last"), or empty (to
 * clear ownership) — to the active/invited owner columns. Guests are rejected
 * (they must be promoted first), and ambiguous names throw with the candidates
 * so the caller can pass a UUID. Name matching is case-insensitive and exact on
 * the full name.
 */
export async function resolveOwner(
  ref: string | null | undefined
): Promise<ResolvedOwner> {
  if (ref == null || ref.trim() === "") {
    return { ownerId: null, invitedOwnerId: null };
  }
  const value = ref.trim();

  if (uuidSchema.safeParse(value).success) {
    const active = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, value),
      columns: { id: true, role: true },
    });
    if (active) {
      // permissions-audit-allow: business-logic data validation, not a permission gate
      if (active.role === "guest") {
        throw new McpToolError(
          "invalid",
          "That user is a guest and must be promoted to member before owning a machine."
        );
      }
      return { ownerId: active.id, invitedOwnerId: null };
    }
    const invited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.id, value),
      columns: { id: true, role: true },
    });
    if (invited) {
      // permissions-audit-allow: business-logic data validation, not a permission gate
      if (invited.role === "guest") {
        throw new McpToolError(
          "invalid",
          "That invited user is a guest and must be promoted before owning a machine."
        );
      }
      return { ownerId: null, invitedOwnerId: invited.id };
    }
    throw new McpToolError("not_found", `No user found with id ${value}.`);
  }

  const matches = await findProfilesByFullName(value);
  // permissions-audit-allow: business-logic data validation, not a permission gate
  const eligible = matches.filter((m) => m.role !== "guest");
  const [first] = eligible;
  if (!first) {
    throw new McpToolError(
      "not_found",
      `No member named "${ref}". Check spelling or pass the user's UUID.`
    );
  }
  if (eligible.length > 1) {
    throw ambiguousName(ref, eligible);
  }
  return { ownerId: first.id, invitedOwnerId: null };
}

/** The issue snapshot every issue tool resolves before acting. */
export interface IssueRef {
  id: string;
  issueNumber: number;
  machineInitials: string;
  title: string;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  frequency: IssueFrequency;
  assignedTo: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  description: ProseMirrorDoc | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

/**
 * Resolve an issue from the pair the MCP surface actually speaks: a machine
 * (initials or UUID) and the per-machine issue number.
 *
 * Issue UUIDs are deliberately not accepted. No tool returns one, so a UUID
 * argument shape would be one the caller can never populate. `unique_issue_number`
 * on (machine_initials, issue_number) is what makes this pair a key.
 *
 * NOTE: `reporterEmail` is never selected. It exists on the row for anonymous
 * and invited reporters and must not leave the server (CORE-SEC-007).
 */
export async function resolveIssue(
  machineRef: string,
  issueNumber: number
): Promise<IssueRef> {
  const machine = await resolveMachine(machineRef);
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.machineInitials, machine.initials),
      eq(issues.issueNumber, issueNumber)
    ),
    columns: {
      id: true,
      issueNumber: true,
      machineInitials: true,
      title: true,
      status: true,
      severity: true,
      priority: true,
      frequency: true,
      assignedTo: true,
      reportedBy: true,
      reporterName: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true,
    },
  });
  if (!issue) {
    throw new McpToolError(
      "not_found",
      `No issue #${issueNumber} on ${machine.initials}. Use list_issues to find the right number.`
    );
  }
  return issue;
}

/**
 * Resolve an assignee argument — a UUID, a full name ("First Last"), or empty
 * (to unassign) — to a `userProfiles.id`.
 *
 * Deliberately NOT {@link resolveOwner}. Machines carry both `ownerId` and
 * `invitedOwnerId`, so ownership can land on an invited user; `issues` has only
 * `assigned_to` referencing `user_profiles`. An invited user therefore has no
 * column to be assigned into, and must be rejected rather than silently
 * dropped — accepting the id and writing nothing would report an assignment
 * that never happened (CORE-ARCH-012).
 */
export async function resolveAssignee(
  ref: string | null | undefined
): Promise<string | null> {
  if (ref == null || ref.trim() === "") return null;
  const value = ref.trim();

  if (uuidSchema.safeParse(value).success) {
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, value),
      columns: { id: true, role: true },
    });
    if (!user) {
      throw new McpToolError(
        "not_found",
        `No user found with id ${value}. Note that invited users cannot be assigned issues.`
      );
    }
    // permissions-audit-allow: business-logic data validation, not a permission gate
    if (user.role === "guest") {
      throw new McpToolError(
        "invalid",
        "That user is a guest and cannot be assigned issues."
      );
    }
    return user.id;
  }

  const matches = await findProfilesByFullName(value);
  // permissions-audit-allow: business-logic data validation, not a permission gate
  const eligible = matches.filter((m) => m.role !== "guest");
  const [first] = eligible;
  if (!first) {
    throw new McpToolError(
      "not_found",
      `No assignable member named "${ref}". Check the spelling, or pass the user's UUID. Guests cannot be assigned issues.`
    );
  }
  if (eligible.length > 1) {
    throw ambiguousName(ref, eligible);
  }
  return first.id;
}

/**
 * Resolve a user for a READ filter — a UUID or a full name — to a
 * `userProfiles.id`, with NO eligibility gate.
 *
 * Deliberately not {@link resolveAssignee}, which answers "may this person be
 * assigned an issue?" and rejects guests. Asking that question of a filter gets
 * the wrong answer for rows that already exist: a member holding assigned issues
 * who is later demoted to guest still owns those rows, and routing the filter
 * through the write-eligibility check would make `list_issues` throw
 * `not_found`/`invalid` for a name whose issues are sitting right there —
 * reporting "no such member" for a search that has matches (CORE-ARCH-012).
 *
 * A name or id that matches nobody at all still throws, so the filter never
 * silently degrades into "no assignee filter" and returns the whole collection.
 */
export async function resolveAssigneeFilter(ref: string): Promise<string> {
  const value = ref.trim();

  if (uuidSchema.safeParse(value).success) {
    const user = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, value),
      columns: { id: true },
    });
    if (!user) {
      throw new McpToolError("not_found", `No user found with id ${value}.`);
    }
    return user.id;
  }

  const matches = await findProfilesByFullName(value);
  const [first] = matches;
  if (!first) {
    throw new McpToolError(
      "not_found",
      `No user named "${ref}". Check the spelling, or pass the user's UUID.`
    );
  }
  if (matches.length > 1) {
    throw ambiguousName(ref, matches);
  }
  return first.id;
}
