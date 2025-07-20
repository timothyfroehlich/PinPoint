import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema } from "./CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema";

export const MachineUncheckedCreateWithoutIssuesInputSchema: z.ZodType<Prisma.MachineUncheckedCreateWithoutIssuesInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      organizationId: z.string(),
      locationId: z.string(),
      modelId: z.string(),
      ownerId: z.string().optional().nullable(),
      ownerNotificationsEnabled: z.boolean().optional(),
      notifyOnNewIssues: z.boolean().optional(),
      notifyOnStatusChanges: z.boolean().optional(),
      notifyOnComments: z.boolean().optional(),
      qrCodeId: z.string().cuid().optional(),
      qrCodeUrl: z.string().optional().nullable(),
      qrCodeGeneratedAt: z.coerce.date().optional().nullable(),
      collections: z
        .lazy(
          () => CollectionUncheckedCreateNestedManyWithoutMachinesInputSchema,
        )
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineUncheckedCreateWithoutIssuesInput>;

export default MachineUncheckedCreateWithoutIssuesInputSchema;
