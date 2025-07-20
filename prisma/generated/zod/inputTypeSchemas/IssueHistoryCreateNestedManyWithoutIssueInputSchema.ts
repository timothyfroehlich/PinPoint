import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryCreateWithoutIssueInputSchema } from "./IssueHistoryCreateWithoutIssueInputSchema";
import { IssueHistoryUncheckedCreateWithoutIssueInputSchema } from "./IssueHistoryUncheckedCreateWithoutIssueInputSchema";
import { IssueHistoryCreateOrConnectWithoutIssueInputSchema } from "./IssueHistoryCreateOrConnectWithoutIssueInputSchema";
import { IssueHistoryCreateManyIssueInputEnvelopeSchema } from "./IssueHistoryCreateManyIssueInputEnvelopeSchema";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";

export const IssueHistoryCreateNestedManyWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryCreateNestedManyWithoutIssueInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema),
          z.lazy(() => IssueHistoryCreateWithoutIssueInputSchema).array(),
          z.lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema),
          z
            .lazy(() => IssueHistoryUncheckedCreateWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueHistoryCreateOrConnectWithoutIssueInputSchema),
          z
            .lazy(() => IssueHistoryCreateOrConnectWithoutIssueInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueHistoryCreateManyIssueInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryCreateNestedManyWithoutIssueInput>;

export default IssueHistoryCreateNestedManyWithoutIssueInputSchema;
