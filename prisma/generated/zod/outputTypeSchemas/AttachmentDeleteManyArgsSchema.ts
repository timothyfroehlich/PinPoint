import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentWhereInputSchema } from "../inputTypeSchemas/AttachmentWhereInputSchema";

export const AttachmentDeleteManyArgsSchema: z.ZodType<Prisma.AttachmentDeleteManyArgs> =
  z
    .object({
      where: AttachmentWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentDeleteManyArgs>;

export default AttachmentDeleteManyArgsSchema;
