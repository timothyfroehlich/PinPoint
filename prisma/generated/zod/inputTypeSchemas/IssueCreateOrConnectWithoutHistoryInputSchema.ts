import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueCreateWithoutHistoryInputSchema } from "./IssueCreateWithoutHistoryInputSchema";
import { IssueUncheckedCreateWithoutHistoryInputSchema } from "./IssueUncheckedCreateWithoutHistoryInputSchema";

export const IssueCreateOrConnectWithoutHistoryInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutHistoryInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => IssueCreateWithoutHistoryInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutHistoryInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueCreateOrConnectWithoutHistoryInput>;

export default IssueCreateOrConnectWithoutHistoryInputSchema;
