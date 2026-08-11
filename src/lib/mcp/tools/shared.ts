import "server-only";

import { createHash } from "node:crypto";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { logMcpToolCall } from "~/lib/mcp/audit";
import {
  requireMcpAuthContext,
  type McpAuthContext,
} from "~/lib/mcp/verify-token";
import { OPEN_STATUSES, type IssueStatus } from "~/lib/issues/status";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import { reportError } from "~/lib/observability/report-error";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type {
  IssueFrequency,
  IssuePriority,
  IssueSeverity,
  UserRole,
} from "~/lib/types";
import { getSiteUrl } from "~/lib/url";
import type { MachinePbmColumns } from "~/services/machines";
import { db } from "~/server/db";
import {
  invitedUsers,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";

/**
 * A tool-level failure that maps to a user-facing MCP error result rather than a
 * 500. `reason` drives the audit outcome and never leaks internal detail.
 */
export class McpToolError extends Error {
  constructor(
    readonly reason: "denied" | "not_found" | "invalid",
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

/** A tool's structured success payload plus entity ids for the audit line. */
export interface ToolOutcome {
  /** Serialized to JSON text as the tool's response content. */
  result: unknown;
  machineId?: string;
  issueId?: string;
  /**
   * Audit outcome override, for a tool that RETURNS a payload but did not fully
   * succeed. `update_issue` applies each field in its own transaction, so a
   * mid-run failure has to come back as a success payload naming what landed —
   * without this, that call would be logged `outcome: "ok"` and a half-applied
   * write would leave no trace in the only server-side record of MCP mutations.
   * Defaults to `"ok"`.
   */
  auditOutcome?: "error";
  /** Short reason paired with {@link auditOutcome} — never raw error text. */
  auditReason?: string;
}

function toTextResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toErrorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Shared harness for every MCP tool handler: resolve the auth context (set by
 * `withMcpAuth`), run the tool, emit the single audit line, and map any
 * {@link McpToolError} to a clean MCP error result. Unexpected errors are
 * reported and returned as a generic failure — never surfaced verbatim.
 */
export async function runTool(
  toolName: string,
  extra: { authInfo?: AuthInfo },
  run: (ctx: McpAuthContext) => Promise<ToolOutcome>
): Promise<CallToolResult> {
  const ctx = requireMcpAuthContext(extra.authInfo);
  try {
    const outcome = await run(ctx);
    logMcpToolCall({
      tool: toolName,
      userId: ctx.userId,
      clientId: ctx.clientId,
      outcome: outcome.auditOutcome ?? "ok",
      machineId: outcome.machineId,
      issueId: outcome.issueId,
      reason: outcome.auditReason,
    });
    return toTextResult(outcome.result);
  } catch (error) {
    if (error instanceof McpToolError) {
      logMcpToolCall({
        tool: toolName,
        userId: ctx.userId,
        clientId: ctx.clientId,
        outcome: error.reason === "denied" ? "denied" : "error",
        reason: error.reason,
      });
      return toErrorResult(error.message);
    }
    reportError(error, { action: `mcp.tool.${toolName}`, userId: ctx.userId });
    logMcpToolCall({
      tool: toolName,
      userId: ctx.userId,
      clientId: ctx.clientId,
      outcome: "error",
      reason: "exception",
    });
    return toErrorResult(
      "Internal error running the tool. The failure has been logged."
    );
  }
}

const uuidSchema = z.string().uuid();

/**
 * The minimal machine snapshot tools need for permission + service calls.
 *
 * Extends {@link MachinePbmColumns} — the same column set the create/edit paths
 * write — so a resolved machine carries its full PinballMap state. That is what
 * `get_machine` reports (via `buildMachinePinballmap`) and what any future write
 * tool needs to carry `pinballmapListed`/`pinballmapLmxId` over from the STORED
 * row rather than from its arguments (PP-o355.29).
 */
export interface MachineRef extends MachinePbmColumns {
  id: string;
  initials: string;
  name: string;
  ownerId: string | null;
  invitedOwnerId: string | null;
  presenceStatus: MachinePresenceStatus;
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
      pinballmapListed: true,
      pinballmapLmxId: true,
      manufacturer: true,
      year: true,
      opdbId: true,
      ipdbId: true,
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

function fullName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
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
  firstName: string;
  lastName: string;
  role: UserRole;
}

/**
 * Case-insensitive exact match on the full name ("First Last").
 *
 * Capped at 5: the only use for more than one match is naming the candidates in
 * the ambiguity error, and an unbounded fetch would trade a longer message for a
 * bigger query.
 */
function findProfilesByFullName(value: string): Promise<NamedProfile[]> {
  return db.query.userProfiles.findMany({
    where: sql`lower(${userProfiles.firstName} || ' ' || ${userProfiles.lastName}) = lower(${value})`,
    columns: { id: true, firstName: true, lastName: true, role: true },
    limit: 5,
  });
}

/** Same name, several people — name the candidates so the caller can pick one. */
function ambiguousName(ref: string, matches: NamedProfile[]): McpToolError {
  const candidates = matches.map((m) => `${fullName(m)} (${m.id})`).join(", ");
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

/**
 * How long an identical mutating call is treated as a retry of the same request
 * rather than a second, deliberate one.
 *
 * MCP has no client-supplied idempotency token, so the key is derived from the
 * call itself: same admin, same target, same field-for-field content, same
 * window. A transport-level retry resends byte-identical arguments and lands on
 * the same key, so the service returns the original row instead of writing a
 * duplicate.
 *
 * The window is what keeps this from being wrong in the other direction — a
 * genuine re-report of the same fault weeks later ("left flipper weak" after a
 * repair regressed) must file a NEW row, not silently resolve to the old one. A
 * retry that straddles a window boundary degrades to the previous behaviour (a
 * duplicate), which is the safe direction to fail.
 */
const RETRY_WINDOW_MS = 10 * 60 * 1000;

/**
 * The joiner for an idempotency key's field parts: a NUL, written as the
 * `\u0000` ESCAPE and never as a literal byte. A literal NUL in the source makes
 * the whole file binary to the toolchain — `git diff` reports "Binary files
 * differ" so the file is unreviewable, and `rg` skips it in directory searches,
 * which silently drops it out of every future codebase sweep.
 */
const KEY_SEPARATOR = "\u0000";

/**
 * Render `parts` as a content-addressed **UUIDv8**, the shared derivation behind
 * every MCP tool's idempotency key.
 *
 * The `idempotency_key` columns are Postgres `uuid`, so the SHA-256 digest is
 * rendered as v8 — the RFC 9562 version reserved for custom,
 * implementation-defined layouts, which is what a hash-derived identifier is.
 * (v4 would misrepresent these bits as random; v5 specifically means SHA-1 over
 * a namespace.)
 *
 * Parts are NUL-joined so no field's content can impersonate a boundary between
 * two others ("ab" + "c" must not hash the same as "a" + "bc"). Callers append
 * `String(Math.floor(now / RETRY_WINDOW_MS))` as the window part.
 *
 * One implementation rather than one per tool: the bit-stamping is the part that
 * has to be identical everywhere, and a second copy is a second chance to get
 * the version or variant nibble wrong in a way no caller would notice.
 */
export function contentAddressedUuid(parts: readonly string[]): string {
  const digest = createHash("sha256")
    .update(parts.join(KEY_SEPARATOR))
    .digest();

  // Take the leading 16 bytes and stamp the version (8) and RFC 4122 variant
  // bits in place, then render the canonical 8-4-4-4-12 form.
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** The current retry window, as the trailing part of an idempotency key. */
export function retryWindowPart(now: number): string {
  return String(Math.floor(now / RETRY_WINDOW_MS));
}

/** Absolute URL for a machine's detail page. */
export function machineUrl(initials: string): string {
  return `${getSiteUrl()}/m/${initials}`;
}

/** Absolute URL for an issue's detail page. */
export function issueUrl(machineInitials: string, issueNumber: number): string {
  return `${getSiteUrl()}/m/${machineInitials}/i/${issueNumber}`;
}

/**
 * Batch-resolve display names for a set of machines' owners (active or invited),
 * keyed by machine id. Two queries total regardless of machine count — never
 * emails (CORE-SEC-007). `null` when a machine has no owner.
 */
export async function getOwnerNamesByMachine(
  rows: readonly {
    id: string;
    ownerId: string | null;
    invitedOwnerId: string | null;
  }[]
): Promise<Map<string, string | null>> {
  const activeIds = [
    ...new Set(rows.flatMap((r) => (r.ownerId ? [r.ownerId] : []))),
  ];
  const invitedIds = [
    ...new Set(
      rows.flatMap((r) => (r.invitedOwnerId ? [r.invitedOwnerId] : []))
    ),
  ];

  const [activeRows, invitedRows] = await Promise.all([
    activeIds.length
      ? db.query.userProfiles.findMany({
          where: inArray(userProfiles.id, activeIds),
          columns: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    invitedIds.length
      ? db.query.invitedUsers.findMany({
          where: inArray(invitedUsers.id, invitedIds),
          columns: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ]);

  const activeNames = new Map(activeRows.map((u) => [u.id, fullName(u)]));
  const invitedNames = new Map(invitedRows.map((u) => [u.id, fullName(u)]));

  return new Map(
    rows.map((r) => {
      const name = r.ownerId
        ? (activeNames.get(r.ownerId) ?? null)
        : r.invitedOwnerId
          ? (invitedNames.get(r.invitedOwnerId) ?? null)
          : null;
      return [r.id, name];
    })
  );
}

/**
 * Count open issues per machine (keyed by initials) in a single grouped query.
 * Machines with no open issues are simply absent from the map (caller defaults
 * to 0).
 */
export async function getOpenIssueCounts(
  initialsList: readonly string[]
): Promise<Map<string, number>> {
  if (initialsList.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      machineInitials: issues.machineInitials,
      openCount: count(),
    })
    .from(issues)
    .where(
      and(
        inArray(issues.machineInitials, [...initialsList]),
        inArray(issues.status, [...OPEN_STATUSES])
      )
    )
    .groupBy(issues.machineInitials);

  return new Map(rows.map((r) => [r.machineInitials, r.openCount]));
}
