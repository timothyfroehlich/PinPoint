import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithoutOrganizationInputSchema } from "./MachineUpdateWithoutOrganizationInputSchema";
import { MachineUncheckedUpdateWithoutOrganizationInputSchema } from "./MachineUncheckedUpdateWithoutOrganizationInputSchema";
import { MachineCreateWithoutOrganizationInputSchema } from "./MachineCreateWithoutOrganizationInputSchema";
import { MachineUncheckedCreateWithoutOrganizationInputSchema } from "./MachineUncheckedCreateWithoutOrganizationInputSchema";

export const MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => MachineUpdateWithoutOrganizationInputSchema),
        z.lazy(() => MachineUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
      create: z.union([
        z.lazy(() => MachineCreateWithoutOrganizationInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineUpsertWithWhereUniqueWithoutOrganizationInput>;

export default MachineUpsertWithWhereUniqueWithoutOrganizationInputSchema;
