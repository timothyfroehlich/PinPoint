import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const MachineCreateManyOwnerInputSchema: z.ZodType<Prisma.MachineCreateManyOwnerInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      organizationId: z.string(),
      locationId: z.string(),
      modelId: z.string(),
      ownerNotificationsEnabled: z.boolean().optional(),
      notifyOnNewIssues: z.boolean().optional(),
      notifyOnStatusChanges: z.boolean().optional(),
      notifyOnComments: z.boolean().optional(),
      qrCodeId: z.string().cuid().optional(),
      qrCodeUrl: z.string().optional().nullable(),
      qrCodeGeneratedAt: z.coerce.date().optional().nullable(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateManyOwnerInput>;

export default MachineCreateManyOwnerInputSchema;
