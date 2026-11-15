/**
 * Issue Server Actions
 *
 * Server-side mutations for issue CRUD operations, each built on the protected
 * action pipeline (CORE-ARCH-013): authenticate, validate, load, check the
 * permission, then run the handler.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { issues, issueComments, issueImages } from "~/server/db/schema";
import { log } from "~/lib/logger";
import { BLOB_CONFIG } from "~/lib/blob/config";
import { reportError } from "~/lib/observability/report-error";
import {
  createProtectedAction,
  formFields,
  revalidateMachine,
  type ActionContext,
  type PermissionId,
  type PermissionRequirement,
  type ProtectedActionResult,
  type ResourceContext,
} from "~/lib/actions";
import {
  getIssueAuthContext,
  type IssueAuthContext,
} from "~/lib/issues/auth-context";
import {
  updateIssueStatusSchema,
  updateIssueSeveritySchema,
  updateIssuePrioritySchema,
  updateIssueFrequencySchema,
  assignIssueSchema,
  addCommentSchema,
  editCommentSchema,
  deleteCommentSchema,
  updateIssueTitleSchema,
  reassignIssueMachineSchema,
  imagesMetadataArraySchema,
} from "./schemas";
import { type Result, ok, err } from "~/lib/result";
import {
  updateIssueStatus,
  addIssueComment,
  assignIssue,
  updateIssueSeverity,
  updateIssuePriority,
  updateIssueFrequency,
  updateIssueComment,
  updateIssueTitle,
  reassignIssueMachine,
  MachineRemovedError,
} from "~/services/issues";
import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import {
  type ProseMirrorDoc,
  docToPlainText,
  proseMirrorDocValueSchema,
} from "~/lib/tiptap/types";

export type UpdateIssueStatusResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type UpdateIssueSeverityResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type UpdateIssuePriorityResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type UpdateIssueFrequencyResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type AssignIssueResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type AddCommentResult = ProtectedActionResult<{
  issueId: string;
  commentId: string;
}>;

export type EditCommentResult = ProtectedActionResult<
  { commentId: string },
  "NOT_FOUND"
>;

export type DeleteCommentResult = ProtectedActionResult<
  { commentId: string },
  "NOT_FOUND"
>;

export type UpdateIssueTitleResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

export type ReassignIssueMachineResult = ProtectedActionResult<
  { issueId: string },
  "NOT_FOUND"
>;

type IssueContext = ResourceContext<ActionContext, IssueAuthContext>;

/** Load the issue an `issueId` input names, for an ownership permission check. */
const loadIssue = ({
  issueId,
}: {
  issueId: string;
}): Promise<Result<IssueAuthContext, "NOT_FOUND">> =>
  getIssueAuthContext(issueId);

/** Require `permission` with the caller's ownership of the loaded issue. */
const issuePermission =
  (permission: PermissionId) =>
  (
    _input: unknown,
    { user, resource }: IssueContext
  ): PermissionRequirement => ({
    permission,
    ownershipContext: {
      userId: user.id,
      reporterId: resource.reportedBy,
      machineOwnerId: resource.machineOwnerId,
    },
  });

/** Revalidate the issue's page and its machine's page. */
function revalidateIssue(issue: IssueAuthContext): void {
  revalidateMachine(issue.machineInitials, [`i/${issue.issueNumber}`]);
}

/**
 * Parse a comment's ProseMirror JSON as part of schema validation, so a bad
 * document is a VALIDATION result before anything is loaded.
 */
function parseCommentDoc(
  commentJson: string,
  ctx: z.RefinementCtx
): ProseMirrorDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(commentJson);
  } catch (e) {
    log.error({ e, commentJson }, "Failed to parse comment JSON");
    ctx.addIssue({ code: "custom", message: "Invalid comment format" });
    return z.NEVER;
  }

  const doc = proseMirrorDocValueSchema.safeParse(parsed);
  if (!doc.success) {
    ctx.addIssue({ code: "custom", message: "Invalid comment format" });
    return z.NEVER;
  }
  if (docToPlainText(doc.data).length === 0) {
    ctx.addIssue({ code: "custom", message: "Comment cannot be empty" });
    return z.NEVER;
  }
  if (JSON.stringify(doc.data).length > 100_000) {
    ctx.addIssue({ code: "custom", message: "Comment is too long." });
    return z.NEVER;
  }
  return doc.data;
}

const addCommentInputSchema = addCommentSchema.transform(
  ({ comment, ...rest }, ctx) => ({
    ...rest,
    comment: parseCommentDoc(comment, ctx),
  })
);

const editCommentInputSchema = editCommentSchema.transform(
  ({ comment, ...rest }, ctx) => ({
    ...rest,
    comment: parseCommentDoc(comment, ctx),
  })
);

/**
 * Load a comment for an edit or delete. System comments (audit events) are
 * never editable, whoever asks.
 */
async function loadUserComment(
  commentId: string,
  systemCommentMessage: string
): Promise<
  Result<
    {
      authorId: string | null;
      issue: { machineInitials: string; issueNumber: number };
    },
    "NOT_FOUND" | "FORBIDDEN"
  >
> {
  const comment = await db.query.issueComments.findFirst({
    where: eq(issueComments.id, commentId),
    columns: { authorId: true, isSystem: true },
    with: {
      issue: { columns: { machineInitials: true, issueNumber: true } },
    },
  });

  if (!comment) {
    return err("NOT_FOUND", "Comment not found");
  }
  if (comment.isSystem) {
    return err("FORBIDDEN", systemCommentMessage);
  }
  return ok({ authorId: comment.authorId, issue: comment.issue });
}

const updateIssueStatusProtected = createProtectedAction({
  actionName: "updateIssueStatus",
  schema: updateIssueStatusSchema,
  mapInput: (formData: FormData) => formFields(formData, ["issueId", "status"]),
  load: loadIssue,
  permission: issuePermission("issues.update.reporting"),
  forbiddenMessage: "You do not have permission to update this issue",
  serverErrorMessage: "Failed to update status",
  handler: async ({ issueId, status }, { user, resource: issue }) => {
    const { deliveryPlan } = await updateIssueStatus({
      issueId,
      status,
      userId: user.id,
    });
    // Deliver post-commit, after the response (PP-2053.3).
    after(() => dispatchNotification(deliveryPlan));

    revalidateIssue(issue);
    return ok({ issueId });
  },
});

/** Update an issue's status and record the timeline event. */
export async function updateIssueStatusAction(
  _prevState: UpdateIssueStatusResult | undefined,
  formData: FormData
): Promise<UpdateIssueStatusResult> {
  return await updateIssueStatusProtected(formData);
}

const updateIssueSeverityProtected = createProtectedAction({
  actionName: "updateIssueSeverity",
  schema: updateIssueSeveritySchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["issueId", "severity"]),
  load: loadIssue,
  permission: issuePermission("issues.update.reporting"),
  forbiddenMessage: "You do not have permission to update this issue",
  serverErrorMessage: "Failed to update severity",
  handler: async ({ issueId, severity }, { user, resource: issue }) => {
    await updateIssueSeverity({ issueId, severity, userId: user.id });

    revalidateIssue(issue);
    return ok({ issueId });
  },
});

/** Update an issue's severity and record the timeline event. */
export async function updateIssueSeverityAction(
  _prevState: UpdateIssueSeverityResult | undefined,
  formData: FormData
): Promise<UpdateIssueSeverityResult> {
  return await updateIssueSeverityProtected(formData);
}

const updateIssueFrequencyProtected = createProtectedAction({
  actionName: "updateIssueFrequency",
  schema: updateIssueFrequencySchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["issueId", "frequency"]),
  load: loadIssue,
  permission: issuePermission("issues.update.reporting"),
  forbiddenMessage: "You do not have permission to update this issue",
  serverErrorMessage: "Failed to update frequency",
  handler: async ({ issueId, frequency }, { user, resource: issue }) => {
    await updateIssueFrequency({ issueId, frequency, userId: user.id });

    revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    return ok({ issueId });
  },
});

/** Update an issue's frequency and record the timeline event. */
export async function updateIssueFrequencyAction(
  _prevState: UpdateIssueFrequencyResult | undefined,
  formData: FormData
): Promise<UpdateIssueFrequencyResult> {
  return await updateIssueFrequencyProtected(formData);
}

const updateIssuePriorityProtected = createProtectedAction({
  actionName: "updateIssuePriority",
  schema: updateIssuePrioritySchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["issueId", "priority"]),
  load: loadIssue,
  permission: issuePermission("issues.update.triage"),
  forbiddenMessage: "You do not have permission to update this issue",
  serverErrorMessage: "Failed to update priority",
  handler: async ({ issueId, priority }, { user, resource: issue }) => {
    await updateIssuePriority({ issueId, priority, userId: user.id });

    revalidateIssue(issue);
    return ok({ issueId });
  },
});

/** Update an issue's priority and record the timeline event. */
export async function updateIssuePriorityAction(
  _prevState: UpdateIssuePriorityResult | undefined,
  formData: FormData
): Promise<UpdateIssuePriorityResult> {
  return await updateIssuePriorityProtected(formData);
}

const assignIssueProtected = createProtectedAction({
  actionName: "assignIssue",
  schema: assignIssueSchema,
  mapInput: (formData: FormData) => {
    const fields = formFields(formData, ["issueId", "assignedTo"]);
    // An empty assignee field means "unassign".
    const assignedTo = fields["assignedTo"];
    return { ...fields, assignedTo: assignedTo === "" ? null : assignedTo };
  },
  load: loadIssue,
  permission: issuePermission("issues.update.triage"),
  forbiddenMessage: "You do not have permission to update this issue",
  serverErrorMessage: "Failed to assign issue",
  handler: async ({ issueId, assignedTo }, { user, resource: issue }) => {
    const { deliveryPlan } = await assignIssue({
      issueId,
      assignedTo,
      actorId: user.id,
    });
    // Deliver post-commit, after the response (PP-2053.3).
    after(() => dispatchNotification(deliveryPlan));

    revalidateIssue(issue);
    return ok({ issueId });
  },
});

/** Assign an issue to a user, or unassign it, and record the timeline event. */
export async function assignIssueAction(
  _prevState: AssignIssueResult | undefined,
  formData: FormData
): Promise<AssignIssueResult> {
  return await assignIssueProtected(formData);
}

const addCommentProtected = createProtectedAction({
  actionName: "addComment",
  schema: addCommentInputSchema,
  mapInput: (formData: FormData) =>
    formFields(formData, [
      "issueId",
      "comment",
      "imagesMetadata",
      "idempotencyKey",
    ]),
  permission: "comments.add",
  forbiddenMessage: "You do not have permission to add comments",
  serverErrorMessage: "Failed to add comment",
  handler: async (
    { issueId, comment, imagesMetadata: imagesMetadataJson, idempotencyKey },
    { user }
  ) => {
    let imagesMetadata: z.infer<typeof imagesMetadataArraySchema> = [];
    if (imagesMetadataJson) {
      try {
        imagesMetadata = imagesMetadataArraySchema.parse(
          JSON.parse(imagesMetadataJson)
        );
      } catch (e) {
        log.error(
          { err: e, issueId },
          "Failed to parse comment images metadata"
        );
        reportError(e, {
          action: "parseCommentImagesMetadata",
          issueId,
          bestEffort: true,
        });
        // Non-blocking — the comment still posts, but images are silently dropped
      }
    }

    if (imagesMetadata.length > BLOB_CONFIG.LIMITS.COMMENT_MAX) {
      return err(
        "VALIDATION",
        `Too many images. Maximum ${BLOB_CONFIG.LIMITS.COMMENT_MAX} images allowed per comment.`
      );
    }

    const { comment: posted, deliveryPlan } = await addIssueComment({
      issueId,
      content: comment,
      userId: user.id,
      imagesMetadata,
      idempotencyKey: idempotencyKey ?? null,
    });
    // Deliver post-commit, after the response (PP-2053.3).
    after(() => dispatchNotification(deliveryPlan));

    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { machineInitials: true, issueNumber: true },
    });
    if (issue) {
      revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    }
    return ok({ issueId, commentId: posted.id });
  },
});

/** Add a comment to an issue. */
export async function addCommentAction(
  _prevState: AddCommentResult | undefined,
  formData: FormData
): Promise<AddCommentResult> {
  return await addCommentProtected(formData);
}

const editCommentProtected = createProtectedAction({
  actionName: "editComment",
  schema: editCommentInputSchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["commentId", "comment"]),
  load: ({ commentId }) =>
    loadUserComment(commentId, "System comments cannot be edited"),
  permission: (_input, { user, resource: existing }) => ({
    permission: "comments.edit",
    ownershipContext: { userId: user.id, reporterId: existing.authorId },
  }),
  forbiddenMessage: "You can only edit your own comments",
  serverErrorMessage: "Failed to edit comment",
  handler: async ({ commentId, comment }, { resource: existing }) => {
    await updateIssueComment({ commentId, content: comment });

    revalidatePath(
      `/m/${existing.issue.machineInitials}/i/${existing.issue.issueNumber}`
    );
    return ok({ commentId });
  },
});

/** Edit the caller's own comment on an issue. */
export async function editCommentAction(
  _prevState: EditCommentResult | undefined,
  formData: FormData
): Promise<EditCommentResult> {
  return await editCommentProtected(formData);
}

const deleteCommentProtected = createProtectedAction({
  actionName: "deleteComment",
  schema: deleteCommentSchema,
  mapInput: (formData: FormData) => formFields(formData, ["commentId"]),
  load: ({ commentId }) =>
    loadUserComment(commentId, "System comments cannot be deleted"),
  // Admins may delete any comment; everyone else only their own.
  permission: (_input, { user, accessLevel, resource: existing }) =>
    checkPermission("comments.delete.any", accessLevel)
      ? { permission: "comments.delete.any" }
      : {
          permission: "comments.delete",
          ownershipContext: { userId: user.id, reporterId: existing.authorId },
        },
  forbiddenMessage:
    "You can only delete your own comments, or you must be an admin",
  serverErrorMessage: "Failed to delete comment",
  handler: async ({ commentId }, { user, resource: existing }) => {
    // Instead of deleting, convert to an audit trail event
    const isOwnComment = existing.authorId === user.id;

    const now = new Date();

    // Soft-delete any images attached to this comment
    await db
      .update(issueImages)
      .set({
        deletedAt: now,
        deletedBy: user.id,
        updatedAt: now,
      })
      .where(eq(issueImages.commentId, commentId));

    // Convert comment to structured audit trail event. Like every other
    // system event, its author is the person who acted — here, whoever
    // deleted it — so Activity can name them (spec §7.11).
    await db
      .update(issueComments)
      .set({
        isSystem: true,
        authorId: user.id,
        content: null,
        eventData: {
          type: "comment_deleted",
          deletedBy: isOwnComment ? "author" : "admin",
        },
        updatedAt: now,
      })
      .where(eq(issueComments.id, commentId));

    log.info(
      { commentId, isOwnComment, action: "deleteComment" },
      "Comment converted to audit trail"
    );

    revalidatePath(
      `/m/${existing.issue.machineInitials}/i/${existing.issue.issueNumber}`
    );
    return ok({ commentId });
  },
});

/** Delete a comment, leaving an audit-trail event in its place. */
export async function deleteCommentAction(
  _prevState: DeleteCommentResult | undefined,
  formData: FormData
): Promise<DeleteCommentResult> {
  return await deleteCommentProtected(formData);
}

const updateIssueTitleProtected = createProtectedAction({
  actionName: "updateIssueTitle",
  schema: updateIssueTitleSchema,
  mapInput: (formData: FormData) => formFields(formData, ["issueId", "title"]),
  load: loadIssue,
  permission: issuePermission("issues.update.reporting"),
  forbiddenMessage: "You do not have permission to edit this issue title",
  serverErrorMessage: "Failed to update title",
  handler: async ({ issueId, title }, { user, resource: issue }) => {
    await updateIssueTitle({ issueId, title, userId: user.id });

    revalidateIssue(issue);
    return ok({ issueId });
  },
});

/**
 * Update an issue's title. Members and admins can edit any title; guests only
 * their own.
 */
export async function updateIssueTitleAction(
  _prevState: UpdateIssueTitleResult | undefined,
  formData: FormData
): Promise<UpdateIssueTitleResult> {
  return await updateIssueTitleProtected(formData);
}

const reassignIssueMachineProtected = createProtectedAction({
  actionName: "reassignIssueMachine",
  schema: reassignIssueMachineSchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["issueId", "newMachineInitials"]),
  load: loadIssue,
  permission: issuePermission("issues.reassign"),
  forbiddenMessage: "You do not have permission to reassign this issue",
  serverErrorMessage: "Failed to reassign issue",
  handler: async (
    { issueId, newMachineInitials },
    { user, resource: issue }
  ) => {
    if (newMachineInitials === issue.machineInitials) {
      return err("VALIDATION", "Issue is already on this machine");
    }

    let result: Awaited<ReturnType<typeof reassignIssueMachine>>;
    try {
      result = await reassignIssueMachine({
        issueId,
        newMachineInitials,
        userId: user.id,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Machine not found")
      ) {
        return err("NOT_FOUND", "Destination machine not found");
      }
      if (error instanceof MachineRemovedError) {
        return err("VALIDATION", error.message);
      }
      throw error;
    }

    // Skip revalidating the current `/m/<from>/i/<N>` — we redirect away from
    // it, and an extra invalidation just adds latency.
    revalidatePath(`/m/${result.fromInitials}`);
    revalidatePath(`/m/${result.toInitials}`);

    // Must be a server-side redirect, not a returned `ok({newUrl})` consumed
    // by `router.push`: returning normally lets Next.js refresh the current
    // page first, which now renders not-found and server-redirects to
    // `/m/<from>` — unmounting the form before the client navigation runs.
    // The pipeline rethrows the redirect signal.
    redirect(`/m/${result.toInitials}/i/${result.toIssueNumber.toString()}`);
  },
});

/**
 * Move an issue to another machine. Reserves a fresh issue number on the
 * destination; the old number on the source becomes a permanent gap. On
 * success it calls `redirect()` server-side to `/m/<to>/i/<N>`, so it only ever
 * returns `err` Results. (Visiting the old `/m/<from>/i/<N>` URL afterwards
 * redirects to `/m/<from>`, because the issue is no longer found there.)
 */
export async function reassignIssueMachineAction(
  _prevState: ReassignIssueMachineResult | undefined,
  formData: FormData
): Promise<ReassignIssueMachineResult> {
  return await reassignIssueMachineProtected(formData);
}
