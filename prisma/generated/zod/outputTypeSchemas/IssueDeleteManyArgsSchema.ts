import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueWhereInputSchema } from "../inputTypeSchemas/IssueWhereInputSchema";

export const IssueDeleteManyArgsSchema: z.ZodType<Prisma.IssueDeleteManyArgs> =
  z
    .object({
      where: IssueWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueDeleteManyArgs>;

export default IssueDeleteManyArgsSchema;
