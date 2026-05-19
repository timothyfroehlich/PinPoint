import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { MachineTimelineActionsRow } from "~/components/machines/timeline/MachineTimelineActionsRow";
import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineSystemRow } from "~/components/machines/timeline/MachineTimelineSystemRow";
import { MachineTimelineTombstoneRow } from "~/components/machines/timeline/MachineTimelineTombstoneRow";
import {
  type AccessLevel,
  checkPermission,
  getAccessLevel,
} from "~/lib/permissions/index";
import { createClient } from "~/lib/supabase/server";
import { getMachineTimeline } from "~/lib/timeline/machine-events";
import { tagSchema, type TimelineTag } from "~/lib/timeline/machine-tags";
import { db } from "~/server/db";
import { machines, userProfiles } from "~/server/db/schema";

interface PageProps {
  params: Promise<{ initials: string }>;
  searchParams: Promise<{ tag?: string }>;
}

/**
 * Machine Timeline Tab (/m/[initials]/timeline)
 *
 * Server component that loads the machine, resolves the current user + access
 * level, runs the matrix-driven `getMachineTimeline` query, and dispatches
 * each row to the appropriate row renderer (comment, system, tombstone).
 *
 * Permissions (AGENTS.md rule 12 — Matrix-Only):
 * - `canDelete` per row uses `checkPermission("machines.timeline.comment.delete", …)`
 *   with the matrix's `admin: true` + `member/technician: own_or_owner` semantics.
 * - The composer is gated by `checkPermission("machines.timeline.comment.add", …)`
 *   so guests never see it (the action enforces the same gate at write time).
 */
export default async function MachineTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const { initials } = await params;
  const { tag: tagParam } = await searchParams;

  // Load the machine (FK target for getMachineTimeline + initials for routes).
  const machine = await db.query.machines.findFirst({
    where: eq(machines.initials, initials),
    columns: { id: true, initials: true, ownerId: true },
  });
  if (!machine) notFound();

  // Parse the CSV `?tag=a,b,c` query param into a validated TimelineTag[].
  // Any unknown values are silently dropped — empty list = "All".
  const tags: TimelineTag[] = tagParam
    ? tagParam
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => tagSchema.safeParse(s))
        .flatMap((r) => (r.success ? [r.data] : []))
    : [];

  // Resolve current user + access level for canDelete + composer gating.
  // AGENTS.md rule 5 (Supabase SSR): createClient() -> auth.getUser() with
  // no logic between.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  // Load access level only if authenticated — unauthenticated users can't
  // delete or post anything.
  let accessLevel: AccessLevel = "unauthenticated";
  if (currentUserId) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, currentUserId),
      columns: { role: true },
    });
    accessLevel = getAccessLevel(profile?.role ?? null);
  }

  const canCompose = checkPermission(
    "machines.timeline.comment.add",
    accessLevel
  );

  const rows = await getMachineTimeline(db, {
    machineId: machine.id,
    ...(tags.length > 0 ? { tags } : {}),
  });

  return (
    <div className="flex flex-col gap-4">
      <MachineTimelineActionsRow
        machineId={machine.id}
        currentTags={tags}
        canCompose={canCompose}
      />
      <div>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No activity yet — this machine&apos;s history will appear here as it
            is added, updated, and serviced.
          </p>
        ) : (
          rows.map((row) => {
            // Tombstone for any soft-deleted row (regardless of source type).
            if (row.deletedAt) {
              return (
                <MachineTimelineTombstoneRow
                  key={row.id}
                  deletedByName={row.deletedByName}
                  deletedAt={row.deletedAt}
                />
              );
            }

            // Validate `row.tag` at this read boundary — the DB column is
            // unconstrained `text`, so a legacy/manual row could carry an
            // out-of-enum value. Skip it rather than blind-casting (PP-0x98 review).
            const parsedRowTag = tagSchema.safeParse(row.tag);
            if (!parsedRowTag.success) return null;
            const rowTag = parsedRowTag.data;

            // User comment.
            if (row.sourceType === "comment" && row.content) {
              // Matrix-only permission checks (AGENTS.md rule 12). Edit
              // uses `own` semantics (author only — even admin/owner can't
              // put words in someone else's mouth); delete uses
              // `own_or_owner` with an admin override.
              const ownership = currentUserId
                ? {
                    userId: currentUserId,
                    reporterId: row.authorId,
                    machineOwnerId: machine.ownerId,
                  }
                : null;
              const canEdit = ownership
                ? checkPermission(
                    "machines.timeline.comment.edit",
                    accessLevel,
                    ownership
                  )
                : false;
              const canDelete = ownership
                ? checkPermission(
                    "machines.timeline.comment.delete",
                    accessLevel,
                    ownership
                  )
                : false;
              return (
                <MachineTimelineCommentRow
                  key={row.id}
                  row={{
                    id: row.id,
                    createdAt: row.createdAt,
                    authorId: row.authorId,
                    authorName: row.authorName,
                    tag: rowTag,
                    content: row.content,
                  }}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              );
            }

            // System event.
            if (row.eventData) {
              return (
                <MachineTimelineSystemRow
                  key={row.id}
                  row={{
                    id: row.id,
                    createdAt: row.createdAt,
                    tag: rowTag,
                    eventData: row.eventData,
                  }}
                  machineInitials={machine.initials}
                />
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
}
