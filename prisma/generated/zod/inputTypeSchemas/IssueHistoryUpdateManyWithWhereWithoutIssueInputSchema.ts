import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryScalarWhereInputSchema } from "./IssueHistoryScalarWhereInputSchema";
import { IssueHistoryUpdateManyMutationInputSchema } from "./IssueHistoryUpdateManyMutationInputSchema";
import { IssueHistoryUncheckedUpdateManyWithoutIssueInputSchema } from "./IssueHistoryUncheckedUpdateManyWithoutIssueInputSchema";

export const IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryUpdateManyWithWhereWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => IssueHistoryScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => IssueHistoryUpdateManyMutationInputSchema),
        z.lazy(() => IssueHistoryUncheckedUpdateManyWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUpdateManyWithWhereWithoutIssueInput>;

export default IssueHistoryUpdateManyWithWhereWithoutIssueInputSchema;
