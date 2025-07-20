import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateManyCreatedByInputSchema } from "./IssueCreateManyCreatedByInputSchema";

export const IssueCreateManyCreatedByInputEnvelopeSchema: z.ZodType<Prisma.IssueCreateManyCreatedByInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => IssueCreateManyCreatedByInputSchema),
        z.lazy(() => IssueCreateManyCreatedByInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueCreateManyCreatedByInputEnvelope>;

export default IssueCreateManyCreatedByInputEnvelopeSchema;
