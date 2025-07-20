import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationFrequencySchema } from './NotificationFrequencySchema';
import { AccountCreateNestedManyWithoutUserInputSchema } from './AccountCreateNestedManyWithoutUserInputSchema';
import { SessionCreateNestedManyWithoutUserInputSchema } from './SessionCreateNestedManyWithoutUserInputSchema';
import { MembershipCreateNestedManyWithoutUserInputSchema } from './MembershipCreateNestedManyWithoutUserInputSchema';
import { MachineCreateNestedManyWithoutOwnerInputSchema } from './MachineCreateNestedManyWithoutOwnerInputSchema';
import { IssueCreateNestedManyWithoutCreatedByInputSchema } from './IssueCreateNestedManyWithoutCreatedByInputSchema';
import { IssueCreateNestedManyWithoutAssignedToInputSchema } from './IssueCreateNestedManyWithoutAssignedToInputSchema';
import { CommentCreateNestedManyWithoutAuthorInputSchema } from './CommentCreateNestedManyWithoutAuthorInputSchema';
import { CommentCreateNestedManyWithoutDeleterInputSchema } from './CommentCreateNestedManyWithoutDeleterInputSchema';
import { UpvoteCreateNestedManyWithoutUserInputSchema } from './UpvoteCreateNestedManyWithoutUserInputSchema';
import { IssueHistoryCreateNestedManyWithoutActorInputSchema } from './IssueHistoryCreateNestedManyWithoutActorInputSchema';
import { NotificationCreateNestedManyWithoutUserInputSchema } from './NotificationCreateNestedManyWithoutUserInputSchema';

export const UserCreateInputSchema: z.ZodType<Prisma.UserCreateInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  emailVerified: z.coerce.date().optional().nullable(),
  image: z.string().optional().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  bio: z.string().optional().nullable(),
  profilePicture: z.string().optional().nullable(),
  emailNotificationsEnabled: z.boolean().optional(),
  pushNotificationsEnabled: z.boolean().optional(),
  notificationFrequency: z.lazy(() => NotificationFrequencySchema).optional(),
  accounts: z.lazy(() => AccountCreateNestedManyWithoutUserInputSchema).optional(),
  sessions: z.lazy(() => SessionCreateNestedManyWithoutUserInputSchema).optional(),
  memberships: z.lazy(() => MembershipCreateNestedManyWithoutUserInputSchema).optional(),
  ownedMachines: z.lazy(() => MachineCreateNestedManyWithoutOwnerInputSchema).optional(),
  issuesCreated: z.lazy(() => IssueCreateNestedManyWithoutCreatedByInputSchema).optional(),
  issuesAssigned: z.lazy(() => IssueCreateNestedManyWithoutAssignedToInputSchema).optional(),
  comments: z.lazy(() => CommentCreateNestedManyWithoutAuthorInputSchema).optional(),
  deletedComments: z.lazy(() => CommentCreateNestedManyWithoutDeleterInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteCreateNestedManyWithoutUserInputSchema).optional(),
  activityHistory: z.lazy(() => IssueHistoryCreateNestedManyWithoutActorInputSchema).optional(),
  notifications: z.lazy(() => NotificationCreateNestedManyWithoutUserInputSchema).optional()
}).strict();

export default UserCreateInputSchema;
