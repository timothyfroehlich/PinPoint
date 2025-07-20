import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryUpdateWithoutIssueInputSchema } from "./IssueHistoryUpdateWithoutIssueInputSchema";
import { IssueHistoryUncheckedUpdateWithoutIssueInputSchema } from "./IssueHistoryUncheckedUpdateWithoutIssueInputSchema";
import { IssueHistoryCreateWithoutIssueInputSchema } from "./IssueHistoryCreateWithoutIssueInputSchema";
import { IssueHistoryUncheckedCreateWithoutIssueInputSchema } from "./IssueHistoryUncheckedCreateWithoutIssueInputSchema";

export const IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryUpsertWithWhereUniqueWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueHistoryUpdateWithoutIssueInputSchema),
        z.lazy(() => IssueHistoryUncheckedUpdateWithoutIssueInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema),
        z.lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUpsertWithWhereUniqueWithoutIssueInput>;

export default IssueHistoryUpsertWithWhereUniqueWithoutIssueInputSchema;
