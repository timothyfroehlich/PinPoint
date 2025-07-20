import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueUpdateManyMutationInputSchema } from "../inputTypeSchemas/IssueUpdateManyMutationInputSchema";
import { IssueUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/IssueUncheckedUpdateManyInputSchema";
import { IssueWhereInputSchema } from "../inputTypeSchemas/IssueWhereInputSchema";

export const IssueUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.IssueUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        IssueUpdateManyMutationInputSchema,
        IssueUncheckedUpdateManyInputSchema,
      ]),
      where: IssueWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyAndReturnArgs>;

export default IssueUpdateManyAndReturnArgsSchema;
