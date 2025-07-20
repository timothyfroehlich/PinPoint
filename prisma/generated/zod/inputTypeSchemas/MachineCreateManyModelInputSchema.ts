import type { Prisma } from '@prisma/client';

import { z } from 'zod';

export const MachineCreateManyModelInputSchema: z.ZodType<Prisma.MachineCreateManyModelInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  organizationId: z.string(),
  locationId: z.string(),
  ownerId: z.string().optional().nullable(),
  ownerNotificationsEnabled: z.boolean().optional(),
  notifyOnNewIssues: z.boolean().optional(),
  notifyOnStatusChanges: z.boolean().optional(),
  notifyOnComments: z.boolean().optional(),
  qrCodeId: z.string().cuid().optional(),
  qrCodeUrl: z.string().optional().nullable(),
  qrCodeGeneratedAt: z.coerce.date().optional().nullable()
}).strict();

export default MachineCreateManyModelInputSchema;
