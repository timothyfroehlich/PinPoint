import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ModelIncludeSchema } from "../inputTypeSchemas/ModelIncludeSchema";
import { ModelWhereInputSchema } from "../inputTypeSchemas/ModelWhereInputSchema";
import { ModelOrderByWithRelationInputSchema } from "../inputTypeSchemas/ModelOrderByWithRelationInputSchema";
import { ModelWhereUniqueInputSchema } from "../inputTypeSchemas/ModelWhereUniqueInputSchema";
import { ModelScalarFieldEnumSchema } from "../inputTypeSchemas/ModelScalarFieldEnumSchema";
import { MachineFindManyArgsSchema } from "../outputTypeSchemas/MachineFindManyArgsSchema";
import { ModelCountOutputTypeArgsSchema } from "../outputTypeSchemas/ModelCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const ModelSelectSchema: z.ZodType<Prisma.ModelSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    manufacturer: z.boolean().optional(),
    year: z.boolean().optional(),
    ipdbId: z.boolean().optional(),
    opdbId: z.boolean().optional(),
    machineType: z.boolean().optional(),
    machineDisplay: z.boolean().optional(),
    isActive: z.boolean().optional(),
    ipdbLink: z.boolean().optional(),
    opdbImgUrl: z.boolean().optional(),
    kineticistUrl: z.boolean().optional(),
    isCustom: z.boolean().optional(),
    machines: z
      .union([z.boolean(), z.lazy(() => MachineFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => ModelCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const ModelFindManyArgsSchema: z.ZodType<Prisma.ModelFindManyArgs> = z
  .object({
    select: ModelSelectSchema.optional(),
    include: z.lazy(() => ModelIncludeSchema).optional(),
    where: ModelWhereInputSchema.optional(),
    orderBy: z
      .union([
        ModelOrderByWithRelationInputSchema.array(),
        ModelOrderByWithRelationInputSchema,
      ])
      .optional(),
    cursor: ModelWhereUniqueInputSchema.optional(),
    take: z.number().optional(),
    skip: z.number().optional(),
    distinct: z
      .union([ModelScalarFieldEnumSchema, ModelScalarFieldEnumSchema.array()])
      .optional(),
  })
  .strict() as z.ZodType<Prisma.ModelFindManyArgs>;

export default ModelFindManyArgsSchema;
