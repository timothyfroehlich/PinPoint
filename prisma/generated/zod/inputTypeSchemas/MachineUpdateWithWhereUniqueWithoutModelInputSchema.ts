import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateWithoutModelInputSchema } from "./MachineUpdateWithoutModelInputSchema";
import { MachineUncheckedUpdateWithoutModelInputSchema } from "./MachineUncheckedUpdateWithoutModelInputSchema";

export const MachineUpdateWithWhereUniqueWithoutModelInputSchema: z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutModelInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => MachineUpdateWithoutModelInputSchema),
        z.lazy(() => MachineUncheckedUpdateWithoutModelInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineUpdateWithWhereUniqueWithoutModelInput>;

export default MachineUpdateWithWhereUniqueWithoutModelInputSchema;
