import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentCreateManyInputSchema } from "../inputTypeSchemas/AttachmentCreateManyInputSchema";

export const AttachmentCreateManyAndReturnArgsSchema: z.ZodType<Prisma.AttachmentCreateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        AttachmentCreateManyInputSchema,
        AttachmentCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateManyAndReturnArgs>;

export default AttachmentCreateManyAndReturnArgsSchema;
