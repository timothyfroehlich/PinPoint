import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { LocationCreateNestedOneWithoutMachinesInputSchema } from "./LocationCreateNestedOneWithoutMachinesInputSchema";
import { ModelCreateNestedOneWithoutMachinesInputSchema } from "./ModelCreateNestedOneWithoutMachinesInputSchema";
import { UserCreateNestedOneWithoutOwnedMachinesInputSchema } from "./UserCreateNestedOneWithoutOwnedMachinesInputSchema";
import { IssueCreateNestedManyWithoutMachineInputSchema } from "./IssueCreateNestedManyWithoutMachineInputSchema";
import { CollectionCreateNestedManyWithoutMachinesInputSchema } from "./CollectionCreateNestedManyWithoutMachinesInputSchema";

export const MachineCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineCreateWithoutOrganizationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      ownerNotificationsEnabled: z.boolean().optional(),
      notifyOnNewIssues: z.boolean().optional(),
      notifyOnStatusChanges: z.boolean().optional(),
      notifyOnComments: z.boolean().optional(),
      qrCodeId: z.string().cuid().optional(),
      qrCodeUrl: z.string().optional().nullable(),
      qrCodeGeneratedAt: z.coerce.date().optional().nullable(),
      location: z.lazy(() => LocationCreateNestedOneWithoutMachinesInputSchema),
      model: z.lazy(() => ModelCreateNestedOneWithoutMachinesInputSchema),
      owner: z
        .lazy(() => UserCreateNestedOneWithoutOwnedMachinesInputSchema)
        .optional(),
      issues: z
        .lazy(() => IssueCreateNestedManyWithoutMachineInputSchema)
        .optional(),
      collections: z
        .lazy(() => CollectionCreateNestedManyWithoutMachinesInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateWithoutOrganizationInput>;

export default MachineCreateWithoutOrganizationInputSchema;
