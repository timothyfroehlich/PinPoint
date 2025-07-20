import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineCreateWithoutCollectionsInputSchema } from "./MachineCreateWithoutCollectionsInputSchema";
import { MachineUncheckedCreateWithoutCollectionsInputSchema } from "./MachineUncheckedCreateWithoutCollectionsInputSchema";

export const MachineCreateOrConnectWithoutCollectionsInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutCollectionsInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MachineCreateWithoutCollectionsInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineCreateOrConnectWithoutCollectionsInput>;

export default MachineCreateOrConnectWithoutCollectionsInputSchema;
