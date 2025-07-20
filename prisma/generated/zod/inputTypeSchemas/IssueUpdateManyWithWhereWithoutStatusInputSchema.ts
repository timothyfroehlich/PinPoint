import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";
import { IssueUpdateManyMutationInputSchema } from "./IssueUpdateManyMutationInputSchema";
import { IssueUncheckedUpdateManyWithoutStatusInputSchema } from "./IssueUncheckedUpdateManyWithoutStatusInputSchema";

export const IssueUpdateManyWithWhereWithoutStatusInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutStatusInput> =
  z
    .object({
      where: z.lazy(() => IssueScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateManyMutationInputSchema),
        z.lazy(() => IssueUncheckedUpdateManyWithoutStatusInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutStatusInput>;

export default IssueUpdateManyWithWhereWithoutStatusInputSchema;
