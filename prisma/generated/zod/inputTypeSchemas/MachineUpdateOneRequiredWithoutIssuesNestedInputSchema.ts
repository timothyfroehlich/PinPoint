import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { MachineCreateWithoutIssuesInputSchema } from "./MachineCreateWithoutIssuesInputSchema";
import { MachineUncheckedCreateWithoutIssuesInputSchema } from "./MachineUncheckedCreateWithoutIssuesInputSchema";
import { MachineCreateOrConnectWithoutIssuesInputSchema } from "./MachineCreateOrConnectWithoutIssuesInputSchema";
import { MachineUpsertWithoutIssuesInputSchema } from "./MachineUpsertWithoutIssuesInputSchema";
import { MachineWhereUniqueInputSchema } from "./MachineWhereUniqueInputSchema";
import { MachineUpdateToOneWithWhereWithoutIssuesInputSchema } from "./MachineUpdateToOneWithWhereWithoutIssuesInputSchema";
import { MachineUpdateWithoutIssuesInputSchema } from "./MachineUpdateWithoutIssuesInputSchema";
import { MachineUncheckedUpdateWithoutIssuesInputSchema } from "./MachineUncheckedUpdateWithoutIssuesInputSchema";

export const MachineUpdateOneRequiredWithoutIssuesNestedInputSchema: z.ZodType<Prisma.MachineUpdateOneRequiredWithoutIssuesNestedInput> =
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
      upsert: z.lazy(() => MachineUpsertWithoutIssuesInputSchema).optional(),
      connect: z.lazy(() => MachineWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => MachineUpdateToOneWithWhereWithoutIssuesInputSchema),
          z.lazy(() => MachineUpdateWithoutIssuesInputSchema),
          z.lazy(() => MachineUncheckedUpdateWithoutIssuesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.MachineUpdateOneRequiredWithoutIssuesNestedInput>;

export default MachineUpdateOneRequiredWithoutIssuesNestedInputSchema;
