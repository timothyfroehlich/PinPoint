import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutIssuesInputSchema } from "./MachineCreateWithoutIssuesInputSchema";
import { MachineUncheckedCreateWithoutIssuesInputSchema } from "./MachineUncheckedCreateWithoutIssuesInputSchema";
import { MachineCreateOrConnectWithoutIssuesInputSchema } from "./MachineCreateOrConnectWithoutIssuesInputSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";

export const MachineCreateNestedOneWithoutIssuesInputSchema: z.ZodType<Prisma.MachineCreateNestedOneWithoutIssuesInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => MachineCreateWithoutIssuesInputSchema),
          z.lazy(() => MachineUncheckedCreateWithoutIssuesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => MachineCreateOrConnectWithoutIssuesInputSchema)
        .optional(),
      connect: z.lazy(() => MachineWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.MachineCreateNestedOneWithoutIssuesInput>;

export default MachineCreateNestedOneWithoutIssuesInputSchema;
