import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineScalarWhereInputSchema } from "./MachineScalarWhereInputSchema";
import { MachineUpdateManyMutationInputSchema } from "./MachineUpdateManyMutationInputSchema";
import { MachineUncheckedUpdateManyWithoutCollectionsInputSchema } from "./MachineUncheckedUpdateManyWithoutCollectionsInputSchema";

export const MachineUpdateManyWithWhereWithoutCollectionsInputSchema: z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutCollectionsInput> =
  z
    .object({
      where: z.lazy(() => MachineScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => MachineUpdateManyMutationInputSchema),
        z.lazy(() => MachineUncheckedUpdateManyWithoutCollectionsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineUpdateManyWithWhereWithoutCollectionsInput>;

export default MachineUpdateManyWithWhereWithoutCollectionsInputSchema;
