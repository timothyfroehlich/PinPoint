import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueCreateWithoutPriorityInputSchema } from "./IssueCreateWithoutPriorityInputSchema";
import { IssueUncheckedCreateWithoutPriorityInputSchema } from "./IssueUncheckedCreateWithoutPriorityInputSchema";

export const IssueCreateOrConnectWithoutPriorityInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutPriorityInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => IssueCreateWithoutPriorityInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueCreateOrConnectWithoutPriorityInput>;

export default IssueCreateOrConnectWithoutPriorityInputSchema;
