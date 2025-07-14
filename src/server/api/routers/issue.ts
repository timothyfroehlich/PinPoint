import { issueAdminRouter } from "./issue.admin";
import { issueAttachmentRouter } from "./issue.attachment";
import { issueCommentRouter } from "./issue.comment";
import { issueCoreRouter } from "./issue.core";
import { issueStatusRouter } from "./issue.status";
import { issueTimelineRouter } from "./issue.timeline";

import { createTRPCRouter } from "~/server/api/trpc";

export const issueRouter = createTRPCRouter({
  ...issueCoreRouter,
  ...issueCommentRouter,
  ...issueAttachmentRouter,
  ...issueStatusRouter,
  ...issueTimelineRouter,
  ...issueAdminRouter,
});
