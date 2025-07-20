import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithoutOrganizationInputSchema } from "./MachineUpdateWithoutOrganizationInputSchema";
import { MachineUncheckedUpdateWithoutOrganizationInputSchema } from "./MachineUncheckedUpdateWithoutOrganizationInputSchema";

export const MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => MachineUpdateWithoutOrganizationInputSchema),
        z.lazy(() => MachineUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutOrganizationInput>;

export default MachineUpdateWithWhereUniqueWithoutOrganizationInputSchema;
