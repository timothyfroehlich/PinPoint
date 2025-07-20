import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentCreateManyInputSchema } from "../inputTypeSchemas/AttachmentCreateManyInputSchema";

export const AttachmentCreateManyArgsSchema: z.ZodType<Prisma.AttachmentCreateManyArgs> =
  z
    .object({
      data: z.union([
        AttachmentCreateManyInputSchema,
        AttachmentCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateManyArgs>;

export default AttachmentCreateManyArgsSchema;
