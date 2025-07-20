import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineScalarWhereInputSchema } from "./MachineScalarWhereInputSchema";
import { MachineUpdateManyMutationInputSchema } from "./MachineUpdateManyMutationInputSchema";
import { MachineUncheckedUpdateManyWithoutLocationInputSchema } from "./MachineUncheckedUpdateManyWithoutLocationInputSchema";

export const MachineUpdateManyWithWhereWithoutLocationInputSchema: z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutLocationInput> =
  z
    .object({
      where: z.lazy(() => MachineScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => MachineUpdateManyMutationInputSchema),
        z.lazy(() => MachineUncheckedUpdateManyWithoutLocationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutLocationInput>;

export default MachineUpdateManyWithWhereWithoutLocationInputSchema;
