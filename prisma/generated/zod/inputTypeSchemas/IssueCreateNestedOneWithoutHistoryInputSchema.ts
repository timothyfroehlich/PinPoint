import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutHistoryInputSchema } from "./IssueCreateWithoutHistoryInputSchema";
import { IssueUncheckedCreateWithoutHistoryInputSchema } from "./IssueUncheckedCreateWithoutHistoryInputSchema";
import { IssueCreateOrConnectWithoutHistoryInputSchema } from "./IssueCreateOrConnectWithoutHistoryInputSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";

export const IssueCreateNestedOneWithoutHistoryInputSchema: z.ZodType<Prisma.IssueCreateNestedOneWithoutHistoryInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutHistoryInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutHistoryInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => IssueCreateOrConnectWithoutHistoryInputSchema)
        .optional(),
      connect: z.lazy(() => IssueWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.IssueCreateNestedOneWithoutHistoryInput>;

export default IssueCreateNestedOneWithoutHistoryInputSchema;
