import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { UserWhereInputSchema } from './UserWhereInputSchema';
import { StringNullableFilterSchema } from './StringNullableFilterSchema';
import { DateTimeNullableFilterSchema } from './DateTimeNullableFilterSchema';
import { DateTimeFilterSchema } from './DateTimeFilterSchema';
import { BoolFilterSchema } from './BoolFilterSchema';
import { EnumNotificationFrequencyFilterSchema } from './EnumNotificationFrequencyFilterSchema';
import { NotificationFrequencySchema } from './NotificationFrequencySchema';
import { AccountListRelationFilterSchema } from './AccountListRelationFilterSchema';
import { SessionListRelationFilterSchema } from './SessionListRelationFilterSchema';
import { MembershipListRelationFilterSchema } from './MembershipListRelationFilterSchema';
import { MachineListRelationFilterSchema } from './MachineListRelationFilterSchema';
import { IssueListRelationFilterSchema } from './IssueListRelationFilterSchema';
import { CommentListRelationFilterSchema } from './CommentListRelationFilterSchema';
import { UpvoteListRelationFilterSchema } from './UpvoteListRelationFilterSchema';
import { IssueHistoryListRelationFilterSchema } from './IssueHistoryListRelationFilterSchema';
import { NotificationListRelationFilterSchema } from './NotificationListRelationFilterSchema';

export const UserWhereUniqueInputSchema: z.ZodType<Prisma.UserWhereUniqueInput> = z.union([
  z.object({
    id: z.string().cuid(),
    email: z.string()
  }),
  z.object({
    id: z.string().cuid(),
  }),
  z.object({
    email: z.string(),
  }),
])
.and(z.object({
  id: z.string().cuid().optional(),
  email: z.string().optional(),
  AND: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  OR: z.lazy(() => UserWhereInputSchema).array().optional(),
  NOT: z.union([ z.lazy(() => UserWhereInputSchema),z.lazy(() => UserWhereInputSchema).array() ]).optional(),
  name: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  emailVerified: z.union([ z.lazy(() => DateTimeNullableFilterSchema),z.coerce.date() ]).optional().nullable(),
  image: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  createdAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  updatedAt: z.union([ z.lazy(() => DateTimeFilterSchema),z.coerce.date() ]).optional(),
  bio: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  profilePicture: z.union([ z.lazy(() => StringNullableFilterSchema),z.string() ]).optional().nullable(),
  emailNotificationsEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  pushNotificationsEnabled: z.union([ z.lazy(() => BoolFilterSchema),z.boolean() ]).optional(),
  notificationFrequency: z.union([ z.lazy(() => EnumNotificationFrequencyFilterSchema),z.lazy(() => NotificationFrequencySchema) ]).optional(),
  accounts: z.lazy(() => AccountListRelationFilterSchema).optional(),
  sessions: z.lazy(() => SessionListRelationFilterSchema).optional(),
  memberships: z.lazy(() => MembershipListRelationFilterSchema).optional(),
  ownedMachines: z.lazy(() => MachineListRelationFilterSchema).optional(),
  issuesCreated: z.lazy(() => IssueListRelationFilterSchema).optional(),
  issuesAssigned: z.lazy(() => IssueListRelationFilterSchema).optional(),
  comments: z.lazy(() => CommentListRelationFilterSchema).optional(),
  deletedComments: z.lazy(() => CommentListRelationFilterSchema).optional(),
  upvotes: z.lazy(() => UpvoteListRelationFilterSchema).optional(),
  activityHistory: z.lazy(() => IssueHistoryListRelationFilterSchema).optional(),
  notifications: z.lazy(() => NotificationListRelationFilterSchema).optional()
}).strict());

export default UserWhereUniqueInputSchema;
