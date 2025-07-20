import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryCreateWithoutActorInputSchema } from "./IssueHistoryCreateWithoutActorInputSchema";
import { IssueHistoryUncheckedCreateWithoutActorInputSchema } from "./IssueHistoryUncheckedCreateWithoutActorInputSchema";
import { IssueHistoryCreateOrConnectWithoutActorInputSchema } from "./IssueHistoryCreateOrConnectWithoutActorInputSchema";
import { IssueHistoryCreateManyActorInputEnvelopeSchema } from "./IssueHistoryCreateManyActorInputEnvelopeSchema";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";

export const IssueHistoryCreateNestedManyWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryCreateNestedManyWithoutActorInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueHistoryCreateWithoutActorInputSchema),
          z.lazy(() => IssueHistoryCreateWithoutActorInputSchema).array(),
          z.lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema),
          z
            .lazy(() => IssueHistoryUncheckedCreateWithoutActorInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueHistoryCreateOrConnectWithoutActorInputSchema),
          z
            .lazy(() => IssueHistoryCreateOrConnectWithoutActorInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueHistoryCreateManyActorInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueHistoryWhereUniqueInputSchema),
          z.lazy(() => IssueHistoryWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryCreateNestedManyWithoutActorInput>;

export default IssueHistoryCreateNestedManyWithoutActorInputSchema;
