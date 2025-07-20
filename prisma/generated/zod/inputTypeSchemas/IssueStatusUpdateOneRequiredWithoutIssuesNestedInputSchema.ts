import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusCreateWithoutIssuesInputSchema } from "./IssueStatusCreateWithoutIssuesInputSchema";
import { IssueStatusUncheckedCreateWithoutIssuesInputSchema } from "./IssueStatusUncheckedCreateWithoutIssuesInputSchema";
import { IssueStatusCreateOrConnectWithoutIssuesInputSchema } from "./IssueStatusCreateOrConnectWithoutIssuesInputSchema";
import { IssueStatusUpsertWithoutIssuesInputSchema } from "./IssueStatusUpsertWithoutIssuesInputSchema";
import { IssueStatusWhereUniqueInputSchema } from "./IssueStatusWhereUniqueInputSchema";
import { IssueStatusUpdateToOneWithWhereWithoutIssuesInputSchema } from "./IssueStatusUpdateToOneWithWhereWithoutIssuesInputSchema";
import { IssueStatusUpdateWithoutIssuesInputSchema } from "./IssueStatusUpdateWithoutIssuesInputSchema";
import { IssueStatusUncheckedUpdateWithoutIssuesInputSchema } from "./IssueStatusUncheckedUpdateWithoutIssuesInputSchema";

export const IssueStatusUpdateOneRequiredWithoutIssuesNestedInputSchema: z.ZodType<Prisma.IssueStatusUpdateOneRequiredWithoutIssuesNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueStatusCreateWithoutIssuesInputSchema),
          z.lazy(() => IssueStatusUncheckedCreateWithoutIssuesInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => IssueStatusCreateOrConnectWithoutIssuesInputSchema)
        .optional(),
      upsert: z
        .lazy(() => IssueStatusUpsertWithoutIssuesInputSchema)
        .optional(),
      connect: z.lazy(() => IssueStatusWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => IssueStatusUpdateToOneWithWhereWithoutIssuesInputSchema),
          z.lazy(() => IssueStatusUpdateWithoutIssuesInputSchema),
          z.lazy(() => IssueStatusUncheckedUpdateWithoutIssuesInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUpdateOneRequiredWithoutIssuesNestedInput>;

export default IssueStatusUpdateOneRequiredWithoutIssuesNestedInputSchema;
