import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AccountFindManyArgsSchema } from "../outputTypeSchemas/AccountFindManyArgsSchema";
import { SessionFindManyArgsSchema } from "../outputTypeSchemas/SessionFindManyArgsSchema";
import { MembershipFindManyArgsSchema } from "../outputTypeSchemas/MembershipFindManyArgsSchema";
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema";
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema";
import { CommentFindManyArgsSchema } from "../outputTypeSchemas/CommentFindManyArgsSchema";
import { UpvoteFindManyArgsSchema } from "../outputTypeSchemas/UpvoteFindManyArgsSchema";
import { IssueHistoryFindManyArgsSchema } from "../outputTypeSchemas/IssueHistoryFindManyArgsSchema";
import { NotificationFindManyArgsSchema } from "../outputTypeSchemas/NotificationFindManyArgsSchema";
import { UserCountOutputTypeArgsSchema } from "../outputTypeSchemas/UserCountOutputTypeArgsSchema";

export const UserIncludeSchema: z.ZodType<Prisma.UserInclude> = z
  .object({
    accounts: z
      .union([z.boolean(), z.lazy(() => AccountFindManyArgsSchema)])
      .optional(),
    sessions: z
      .union([z.boolean(), z.lazy(() => SessionFindManyArgsSchema)])
      .optional(),
    memberships: z
      .union([z.boolean(), z.lazy(() => MembershipFindManyArgsSchema)])
      .optional(),
    ownedMachines: z
      .union([z.boolean(), z.lazy(() => MachineFindManyArgsSchema)])
      .optional(),
    issuesCreated: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    issuesAssigned: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    comments: z
      .union([z.boolean(), z.lazy(() => CommentFindManyArgsSchema)])
      .optional(),
    deletedComments: z
      .union([z.boolean(), z.lazy(() => CommentFindManyArgsSchema)])
      .optional(),
    upvotes: z
      .union([z.boolean(), z.lazy(() => UpvoteFindManyArgsSchema)])
      .optional(),
    activityHistory: z
      .union([z.boolean(), z.lazy(() => IssueHistoryFindManyArgsSchema)])
      .optional(),
    notifications: z
      .union([z.boolean(), z.lazy(() => NotificationFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => UserCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export default UserIncludeSchema;
