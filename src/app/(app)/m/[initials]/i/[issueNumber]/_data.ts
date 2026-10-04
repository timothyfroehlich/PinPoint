import "server-only";

import { and, eq } from "drizzle-orm";

import { resolveIssueActivityEvents } from "~/lib/timeline/events";
import { loadMentionNames } from "~/lib/tiptap/mention-names";
import { applyMentionNames } from "~/lib/tiptap/types";
import type { IssueWithAllRelations } from "~/lib/types";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

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
