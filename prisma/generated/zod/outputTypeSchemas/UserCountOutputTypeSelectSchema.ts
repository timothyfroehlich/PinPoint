import { z } from 'zod';
import type { Prisma } from '@prisma/client';

export const UserCountOutputTypeSelectSchema: z.ZodType<Prisma.UserCountOutputTypeSelect> = z.object({
  accounts: z.boolean().optional(),
  sessions: z.boolean().optional(),
  memberships: z.boolean().optional(),
  ownedMachines: z.boolean().optional(),
  issuesCreated: z.boolean().optional(),
  issuesAssigned: z.boolean().optional(),
  comments: z.boolean().optional(),
  deletedComments: z.boolean().optional(),
  upvotes: z.boolean().optional(),
  activityHistory: z.boolean().optional(),
  notifications: z.boolean().optional(),
}).strict();

export default UserCountOutputTypeSelectSchema;
