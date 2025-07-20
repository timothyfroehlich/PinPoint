import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityCreateWithoutIssuesInputSchema } from "./PriorityCreateWithoutIssuesInputSchema";
import { PriorityUncheckedCreateWithoutIssuesInputSchema } from "./PriorityUncheckedCreateWithoutIssuesInputSchema";
import { PriorityCreateOrConnectWithoutIssuesInputSchema } from "./PriorityCreateOrConnectWithoutIssuesInputSchema";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";

export const PriorityCreateNestedOneWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityCreateNestedOneWithoutIssuesInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => PriorityCreateWithoutIssuesInputSchema),
          z.lazy(() => PriorityUncheckedCreateWithoutIssuesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => PriorityCreateOrConnectWithoutIssuesInputSchema)
        .optional(),
      connect: z.lazy(() => PriorityWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateNestedOneWithoutIssuesInput>;

export default PriorityCreateNestedOneWithoutIssuesInputSchema;
