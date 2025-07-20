import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineCreateWithoutOrganizationInputSchema } from "./MachineCreateWithoutOrganizationInputSchema";
import { MachineUncheckedCreateWithoutOrganizationInputSchema } from "./MachineUncheckedCreateWithoutOrganizationInputSchema";

export const MachineCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MachineCreateWithoutOrganizationInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineCreateOrConnectWithoutOrganizationInput>;

export default MachineCreateOrConnectWithoutOrganizationInputSchema;
