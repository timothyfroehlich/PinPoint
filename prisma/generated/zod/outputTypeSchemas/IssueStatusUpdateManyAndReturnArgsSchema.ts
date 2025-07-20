import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { IssueStatusUpdateManyMutationInputSchema } from "../inputTypeSchemas/IssueStatusUpdateManyMutationInputSchema";
import { IssueStatusUncheckedUpdateManyInputSchema } from "../inputTypeSchemas/IssueStatusUncheckedUpdateManyInputSchema";
import { IssueStatusWhereInputSchema } from "../inputTypeSchemas/IssueStatusWhereInputSchema";

export const IssueStatusUpdateManyAndReturnArgsSchema: z.ZodType<Prisma.IssueStatusUpdateManyAndReturnArgs> =
  z
    .object({
      data: z.union([
        IssueStatusUpdateManyMutationInputSchema,
        IssueStatusUncheckedUpdateManyInputSchema,
      ]),
      where: IssueStatusWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUpdateManyAndReturnArgs>;

export default IssueStatusUpdateManyAndReturnArgsSchema;
