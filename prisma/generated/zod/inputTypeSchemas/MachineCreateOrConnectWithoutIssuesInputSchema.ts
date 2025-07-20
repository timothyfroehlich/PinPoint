import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineCreateWithoutIssuesInputSchema } from "./MachineCreateWithoutIssuesInputSchema";
import { MachineUncheckedCreateWithoutIssuesInputSchema } from "./MachineUncheckedCreateWithoutIssuesInputSchema";

export const MachineCreateOrConnectWithoutIssuesInputSchema: z.ZodType<Prisma.MachineCreateOrConnectWithoutIssuesInput> =
  z
    .object({
      where: z.lazy(() => MachineWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => MachineCreateWithoutIssuesInputSchema),
        z.lazy(() => MachineUncheckedCreateWithoutIssuesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.MachineCreateOrConnectWithoutIssuesInput>;

export default MachineCreateOrConnectWithoutIssuesInputSchema;
