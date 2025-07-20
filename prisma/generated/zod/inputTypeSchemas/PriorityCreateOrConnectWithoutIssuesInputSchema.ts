import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";
import { PriorityCreateWithoutIssuesInputSchema } from "./PriorityCreateWithoutIssuesInputSchema";
import { PriorityUncheckedCreateWithoutIssuesInputSchema } from "./PriorityUncheckedCreateWithoutIssuesInputSchema";

export const PriorityCreateOrConnectWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityCreateOrConnectWithoutIssuesInput> =
  z
    .object({
      where: z.lazy(() => PriorityWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => PriorityCreateWithoutIssuesInputSchema),
        z.lazy(() => PriorityUncheckedCreateWithoutIssuesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateOrConnectWithoutIssuesInput>;

export default PriorityCreateOrConnectWithoutIssuesInputSchema;
