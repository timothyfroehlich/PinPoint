import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { IssueUncheckedCreateNestedManyWithoutMachineInputSchema } from './IssueUncheckedCreateNestedManyWithoutMachineInputSchema';
import { CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema } from './CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema';

export const MachineUncheckedCreateWithoutLocationInputSchema: z.ZodType<Prisma.MachineUncheckedCreateWithoutLocationInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  organizationId: z.string(),
  modelId: z.string(),
  ownerId: z.string().optional().nullable(),
  ownerNotificationsEnabled: z.boolean().optional(),
  notifyOnNewIssues: z.boolean().optional(),
  notifyOnStatusChanges: z.boolean().optional(),
  notifyOnComments: z.boolean().optional(),
  qrCodeId: z.string().cuid().optional(),
  qrCodeUrl: z.string().optional().nullable(),
  qrCodeGeneratedAt: z.coerce.date().optional().nullable(),
  issues: z.lazy(() => IssueUncheckedCreateNestedManyWithoutMachineInputSchema).optional(),
  collections: z.lazy(() => CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema).optional()
}).strict();

export default MachineUncheckedCreateWithoutLocationInputSchema;
