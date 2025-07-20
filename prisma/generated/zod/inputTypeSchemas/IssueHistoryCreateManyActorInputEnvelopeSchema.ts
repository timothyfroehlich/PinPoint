import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryCreateManyActorInputSchema } from "./IssueHistoryCreateManyActorInputSchema";

export const IssueHistoryCreateManyActorInputEnvelopeSchema: z.ZodType<Prisma.IssueHistoryCreateManyActorInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => IssueHistoryCreateManyActorInputSchema),
        z.lazy(() => IssueHistoryCreateManyActorInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryCreateManyActorInputEnvelope>;

export default IssueHistoryCreateManyActorInputEnvelopeSchema;
