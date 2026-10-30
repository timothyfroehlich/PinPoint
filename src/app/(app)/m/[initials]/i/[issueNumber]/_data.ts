import "server-only";

import { cache } from "react";
import { and, asc, eq, ne, notInArray, sql } from "drizzle-orm";

import { resolveIssueActivityEvents } from "~/lib/timeline/events";
import { loadMentionNames } from "~/lib/tiptap/mention-names";
import { applyMentionNames } from "~/lib/tiptap/types";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { IssueWithAllRelations } from "~/lib/types";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";

/**
 * The issue detail page's issue, with its machine, people, comments, images,
 * and watchers.
 *
 * Mentions in the description, the machine's owner requirements, and every
 * comment carry the mentioned person's current name — one name lookup for the
 * whole page, after the issue query. The comment editor opens on these same
 * docs, so a re-edited comment saves the current name too. Assignment events
 * in Activity resolve to the assignee's current name the same way, in a
 * lookup run alongside it (PP-0fg0.1).
 *
 * `reporterEmail` is never selected (CORE-SEC-007).
 */
export async function getIssueForDetail(
  initials: string,
  issueNumber: number
): Promise<IssueWithAllRelations | undefined> {
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.machineInitials, initials),
      eq(issues.issueNumber, issueNumber)
    ),
    columns: { reporterEmail: false },
    with: {
      machine: {
        columns: {
          id: true,
          name: true,
          initials: true,
          ownerRequirements: true,
        },
        with: {
          owner: {
            columns: {
              id: true,
              name: true,
            },
          },
          invitedOwner: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
      reportedByUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      assignedToUser: {
        columns: {
          id: true,
          name: true,
        },
      },
      invitedReporter: {
        columns: {
          id: true,
          name: true,
        },
      },
      comments: {
        orderBy: (comments, { asc: orderAsc }) => [
          orderAsc(comments.createdAt),
        ],
        with: {
          author: {
            columns: {
              id: true,
              name: true,
            },
          },
          images: {
            where: (images, { isNull }) => isNull(images.deletedAt),
          },
        },
      },
      images: {
        where: (images, { isNull }) => isNull(images.deletedAt),
      },
      watchers: {
        columns: { userId: true },
      },
    },
  });
  if (!issue) return undefined;

  const [names, comments] = await Promise.all([
    loadMentionNames([
      issue.description,
      issue.machine.ownerRequirements,
      ...issue.comments.map((comment) => comment.content),
    ]),
    resolveIssueActivityEvents(issue.comments),
  ]);
  return {
    ...issue,
    description: applyMentionNames(issue.description, names),
    machine: {
      ...issue.machine,
      ownerRequirements: applyMentionNames(
        issue.machine.ownerRequirements,
        names
      ),
    },
    comments: comments.map((comment) => ({
      ...comment,
      content: applyMentionNames(comment.content, names),
    })),
  };
}

/**
 * The machine's other open issues for the Other issues section: the newest
 * `limit` of them, and how many there are in all (spec §10.5, §11.1). Both
 * queries run in parallel.
 */
export const getOtherOpenIssues = cache(
  async (initials: string, issueNumber: number, limit: number) => {
    const otherOpenIssues = and(
      eq(issues.machineInitials, initials),
      ne(issues.issueNumber, issueNumber),
      notInArray(issues.status, [...CLOSED_STATUSES])
    );
    const [rows, count] = await Promise.all([
      db.query.issues.findMany({
        where: otherOpenIssues,
        columns: {
          id: true,
          issueNumber: true,
          title: true,
          status: true,
          severity: true,
          priority: true,
          frequency: true,
          machineInitials: true,
          createdAt: true,
          reporterName: true,
        },
        orderBy: (otherIssue, { desc }) => [desc(otherIssue.createdAt)],
        limit,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(otherOpenIssues)
        .then((result) => result[0]?.count ?? 0),
    ]);
    return { issues: rows, count };
  }
);

/**
 * Everyone an issue can be assigned to — every account that is not a guest —
 * by name, for the triage picker. Only id and name (CORE-SEC-007).
 * `cache()`-wrapped per request.
 */
export const getAssigneeRoster = cache(async () =>
  db
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .where(notInArray(userProfiles.role, ["guest"]))
    .orderBy(asc(userProfiles.name))
);
