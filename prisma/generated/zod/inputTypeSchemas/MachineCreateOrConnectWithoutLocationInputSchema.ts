import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineCreateWithoutLocationInputSchema } from "./MachineCreateWithoutLocationInputSchema";
import { MachineUncheckedCreateWithoutLocationInputSchema } from "./MachineUncheckedCreateWithoutLocationInputSchema";

export const MachineCreateOrConnectWithoutLocationInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutLocationInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MachineCreateWithoutLocationInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutLocationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineCreateOrConnectWithoutLocationInput>;

export default MachineCreateOrConnectWithoutLocationInputSchema;
