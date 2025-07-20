import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UpvoteCreateManyUserInputSchema } from "./UpvoteCreateManyUserInputSchema";

export const UpvoteCreateManyUserInputEnvelopeSchema: z.ZodType<Prisma.UpvoteCreateManyUserInputEnvelope> =
  z
    .object({
      data: z.union([
        z.lazy(() => UpvoteCreateManyUserInputSchema),
        z.lazy(() => UpvoteCreateManyUserInputSchema).array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateManyUserInputEnvelope>;

export default UpvoteCreateManyUserInputEnvelopeSchema;
