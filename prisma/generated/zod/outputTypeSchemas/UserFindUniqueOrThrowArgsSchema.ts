import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UserIncludeSchema } from "../inputTypeSchemas/UserIncludeSchema";
import { UserWhereUniqueInputSchema } from "../inputTypeSchemas/UserWhereUniqueInputSchema";
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
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const UserSelectSchema: z.ZodType<Prisma.UserSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    email: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
    image: z.boolean().optional(),
    createdAt: z.boolean().optional(),
    updatedAt: z.boolean().optional(),
    bio: z.boolean().optional(),
    profilePicture: z.boolean().optional(),
    emailNotificationsEnabled: z.boolean().optional(),
    pushNotificationsEnabled: z.boolean().optional(),
    notificationFrequency: z.boolean().optional(),
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

export const UserFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.UserFindUniqueOrThrowArgs> =
  z
    .object({
      select: UserSelectSchema.optional(),
      include: z.lazy(() => UserIncludeSchema).optional(),
      where: UserWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.UserFindUniqueOrThrowArgs>;

export default UserFindUniqueOrThrowArgsSchema;
