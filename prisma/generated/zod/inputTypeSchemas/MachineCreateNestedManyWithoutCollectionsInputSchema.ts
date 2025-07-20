import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutCollectionsInputSchema } from "./MachineCreateWithoutCollectionsInputSchema";
import { MachineUncheckedCreateWithoutCollectionsInputSchema } from "./MachineUncheckedCreateWithoutCollectionsInputSchema";
import { MachineCreateOrConnectWithoutCollectionsInputSchema } from "./MachineCreateOrConnectWithoutCollectionsInputSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";

export const MachineCreateNestedManyWithoutCollectionsInputSchema: z.ZodType<Prisma.MachineCreateNestedManyWithoutCollectionsInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MachineCreateWithoutCollectionsInputSchema),
          z.lazy(() => MachineCreateWithoutCollectionsInputSchema).array(),
          z.lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema),
          z
            .lazy(() => MachineUncheckedCreateWithoutCollectionsInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => MachineCreateOrConnectWithoutCollectionsInputSchema),
          z
            .lazy(() => MachineCreateOrConnectWithoutCollectionsInputSchema)
            .array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => MachineWhereUniqueInputSchema),
          z.lazy(() => MachineWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateNestedManyWithoutCollectionsInput>;

export default MachineCreateNestedManyWithoutCollectionsInputSchema;
