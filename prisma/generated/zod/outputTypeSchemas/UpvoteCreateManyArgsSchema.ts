import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteCreateManyInputSchema } from "../inputTypeSchemas/UpvoteCreateManyInputSchema";

export const UpvoteCreateManyArgsSchema: z.ZodType<Prisma.UpvoteCreateManyArgs> =
  z
    .object({
      data: z.union([
        UpvoteCreateManyInputSchema,
        UpvoteCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateManyArgs>;

export default UpvoteCreateManyArgsSchema;
