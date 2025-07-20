import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { AttachmentWhereInputSchema } from "../inputTypeSchemas/AttachmentWhereInputSchema";
import { AttachmentOrderByWithRelationInputSchema } from "../inputTypeSchemas/AttachmentOrderByWithRelationInputSchema";
import { AttachmentWhereUniqueInputSchema } from "../inputTypeSchemas/AttachmentWhereUniqueInputSchema";

export const AttachmentAggregateArgsSchema: z.ZodType<Prisma.AttachmentAggregateArgs> =
  z
    .object({
      where: AttachmentWhereInputSchema.optional(),
      orderBy: z
        .union([
          AttachmentOrderByWithRelationInputSchema.array(),
          AttachmentOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: AttachmentWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.AttachmentAggregateArgs>;

export default AttachmentAggregateArgsSchema;
