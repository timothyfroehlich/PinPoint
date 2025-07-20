import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { SortOrderSchema } from './SortOrderSchema';
import { SortOrderInputSchema } from './SortOrderInputSchema';
import { AccountOrderByRelationAggregateInputSchema } from './AccountOrderByRelationAggregateInputSchema';
import { SessionOrderByRelationAggregateInputSchema } from './SessionOrderByRelationAggregateInputSchema';
import { MembershipOrderByRelationAggregateInputSchema } from './MembershipOrderByRelationAggregateInputSchema';
import { MachineOrderByRelationAggregateInputSchema } from './MachineOrderByRelationAggregateInputSchema';
import { IssueOrderByRelationAggregateInputSchema } from './IssueOrderByRelationAggregateInputSchema';
import { CommentOrderByRelationAggregateInputSchema } from './CommentOrderByRelationAggregateInputSchema';
import { UpvoteOrderByRelationAggregateInputSchema } from './UpvoteOrderByRelationAggregateInputSchema';
import { IssueHistoryOrderByRelationAggregateInputSchema } from './IssueHistoryOrderByRelationAggregateInputSchema';
import { NotificationOrderByRelationAggregateInputSchema } from './NotificationOrderByRelationAggregateInputSchema';

export const UserOrderByWithRelationInputSchema: z.ZodType<Prisma.UserOrderByWithRelationInput> = z.object({
  id: z.lazy(() => SortOrderSchema).optional(),
  name: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  email: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  emailVerified: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  image: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  createdAt: z.lazy(() => SortOrderSchema).optional(),
  updatedAt: z.lazy(() => SortOrderSchema).optional(),
  bio: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  profilePicture: z.union([ z.lazy(() => SortOrderSchema),z.lazy(() => SortOrderInputSchema) ]).optional(),
  emailNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
  pushNotificationsEnabled: z.lazy(() => SortOrderSchema).optional(),
  notificationFrequency: z.lazy(() => SortOrderSchema).optional(),
  accounts: z.lazy(() => AccountOrderByRelationAggregateInputSchema).optional(),
  sessions: z.lazy(() => SessionOrderByRelationAggregateInputSchema).optional(),
  memberships: z.lazy(() => MembershipOrderByRelationAggregateInputSchema).optional(),
  ownedMachines: z.lazy(() => MachineOrderByRelationAggregateInputSchema).optional(),
  issuesCreated: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional(),
  issuesAssigned: z.lazy(() => IssueOrderByRelationAggregateInputSchema).optional(),
  comments: z.lazy(() => CommentOrderByRelationAggregateInputSchema).optional(),
  deletedComments: z.lazy(() => CommentOrderByRelationAggregateInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteOrderByRelationAggregateInputSchema).optional(),
  activityHistory: z.lazy(() => IssueHistoryOrderByRelationAggregateInputSchema).optional(),
  notifications: z.lazy(() => NotificationOrderByRelationAggregateInputSchema).optional()
}).strict();

export default UserOrderByWithRelationInputSchema;
