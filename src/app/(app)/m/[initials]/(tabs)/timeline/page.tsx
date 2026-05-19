import type React from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { MachineTimelineCommentRow } from "~/components/machines/timeline/MachineTimelineCommentRow";
import { MachineTimelineComposer } from "~/components/machines/timeline/MachineTimelineComposer";
import { MachineTimelineFilter } from "~/components/machines/timeline/MachineTimelineFilter";
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

  // Validate the tag param (any invalid value is treated as "no filter").
  const parsedTag = tagParam ? tagSchema.safeParse(tagParam) : null;
  const tag: TimelineTag | undefined = parsedTag?.success
    ? parsedTag.data
    : undefined;

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
    ...(tag ? { tag } : {}),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <MachineTimelineFilter currentTag={tag} />
      </div>
      {canCompose ? <MachineTimelineComposer machineId={machine.id} /> : null}
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

            // User comment.
            if (row.sourceType === "comment" && row.content) {
              // Matrix-only permission check (AGENTS.md rule 12). Admin
              // override, own/owner OR semantics — all encoded in the matrix
              // entry for `machines.timeline.comment.delete`.
              const canDelete = currentUserId
                ? checkPermission(
                    "machines.timeline.comment.delete",
                    accessLevel,
                    {
                      userId: currentUserId,
                      reporterId: row.authorId,
                      machineOwnerId: machine.ownerId,
                    }
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
                    tag: row.tag as TimelineTag,
                    content: row.content,
                  }}
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
                    tag: row.tag as TimelineTag,
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
