import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineCreateWithoutModelInputSchema } from "./MachineCreateWithoutModelInputSchema";
import { MachineUncheckedCreateWithoutModelInputSchema } from "./MachineUncheckedCreateWithoutModelInputSchema";

export const MachineCreateOrConnectWithoutModelInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutModelInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MachineCreateWithoutModelInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutModelInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineCreateOrConnectWithoutModelInput>;

export default MachineCreateOrConnectWithoutModelInputSchema;
