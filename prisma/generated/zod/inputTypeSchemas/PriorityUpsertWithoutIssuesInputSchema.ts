import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityUpdateWithoutIssuesInputSchema } from "./PriorityUpdateWithoutIssuesInputSchema";
import { PriorityUncheckedUpdateWithoutIssuesInputSchema } from "./PriorityUncheckedUpdateWithoutIssuesInputSchema";
import { PriorityCreateWithoutIssuesInputSchema } from "./PriorityCreateWithoutIssuesInputSchema";
import { PriorityUncheckedCreateWithoutIssuesInputSchema } from "./PriorityUncheckedCreateWithoutIssuesInputSchema";
import { PriorityWhereInputSchema } from "./PriorityWhereInputSchema";

export const PriorityUpsertWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityUpsertWithoutIssuesInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => PriorityUpdateWithoutIssuesInputSchema),
        z.lazy(() => PriorityUncheckedUpdateWithoutIssuesInputSchema),
      ]),
      create: z.union([
        z.lazy(() => PriorityCreateWithoutIssuesInputSchema),
        z.lazy(() => PriorityUncheckedCreateWithoutIssuesInputSchema),
      ]),
      where: z.lazy(() => PriorityWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityUpsertWithoutIssuesInput>;

export default PriorityUpsertWithoutIssuesInputSchema;
