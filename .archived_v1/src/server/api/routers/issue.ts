import { issueAttachmentRouter } from "./issue.attachment";
import { issueCommentRouter } from "./issue.comment";
import { issueCoreRouter } from "./issue.core";
import { issueTimelineRouter } from "./issue.timeline";

import { createTRPCRouter } from "~/server/api/trpc";

export const issueRouter = createTRPCRouter({
  core: issueCoreRouter,
  comment: issueCommentRouter,
  attachment: issueAttachmentRouter,
  timeline: issueTimelineRouter,
});
