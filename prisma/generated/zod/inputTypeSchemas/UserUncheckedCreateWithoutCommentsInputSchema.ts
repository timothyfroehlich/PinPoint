import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { NotificationFrequencySchema } from './NotificationFrequencySchema';
import { AccountUncheckedCreateNestedManyWithoutUserInputSchema } from './AccountUncheckedCreateNestedManyWithoutUserInputSchema';
import { SessionUncheckedCreateNestedManyWithoutUserInputSchema } from './SessionUncheckedCreateNestedManyWithoutUserInputSchema';
import { MembershipUncheckedCreateNestedManyWithoutUserInputSchema } from './MembershipUncheckedCreateNestedManyWithoutUserInputSchema';
import { MachineUncheckedCreateNestedManyWithoutOwnerInputSchema } from './MachineUncheckedCreateNestedManyWithoutOwnerInputSchema';
import { IssueUncheckedCreateNestedManyWithoutCreatedByInputSchema } from './IssueUncheckedCreateNestedManyWithoutCreatedByInputSchema';
import { IssueUncheckedCreateNestedManyWithoutAssignedToInputSchema } from './IssueUncheckedCreateNestedManyWithoutAssignedToInputSchema';
import { CommentUncheckedCreateNestedManyWithoutDeleterInputSchema } from './CommentUncheckedCreateNestedManyWithoutDeleterInputSchema';
import { UpvoteUncheckedCreateNestedManyWithoutUserInputSchema } from './UpvoteUncheckedCreateNestedManyWithoutUserInputSchema';
import { IssueHistoryUncheckedCreateNestedManyWithoutActorInputSchema } from './IssueHistoryUncheckedCreateNestedManyWithoutActorInputSchema';
import { NotificationUncheckedCreateNestedManyWithoutUserInputSchema } from './NotificationUncheckedCreateNestedManyWithoutUserInputSchema';

export const UserUncheckedCreateWithoutCommentsInputSchema: z.ZodType<Prisma.UserUncheckedCreateWithoutCommentsInput> = z.object({
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
  accounts: z.lazy(() => AccountUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
  sessions: z.lazy(() => SessionUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
  memberships: z.lazy(() => MembershipUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
  ownedMachines: z.lazy(() => MachineUncheckedCreateNestedManyWithoutOwnerInputSchema).optional(),
  issuesCreated: z.lazy(() => IssueUncheckedCreateNestedManyWithoutCreatedByInputSchema).optional(),
  issuesAssigned: z.lazy(() => IssueUncheckedCreateNestedManyWithoutAssignedToInputSchema).optional(),
  deletedComments: z.lazy(() => CommentUncheckedCreateNestedManyWithoutDeleterInputSchema).optional(),
  upvotes: z.lazy(() => UpvoteUncheckedCreateNestedManyWithoutUserInputSchema).optional(),
  activityHistory: z.lazy(() => IssueHistoryUncheckedCreateNestedManyWithoutActorInputSchema).optional(),
  notifications: z.lazy(() => NotificationUncheckedCreateNestedManyWithoutUserInputSchema).optional()
}).strict();

export default UserUncheckedCreateWithoutCommentsInputSchema;
