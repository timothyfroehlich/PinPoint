import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { UpvoteCreateManyInputSchema } from "../inputTypeSchemas/UpvoteCreateManyInputSchema";

export const UpvoteCreateManyAndReturnArgsSchema: z.ZodType<Prisma.UpvoteCreateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        UpvoteCreateManyInputSchema,
        UpvoteCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateManyAndReturnArgs>;

export default UpvoteCreateManyAndReturnArgsSchema;
