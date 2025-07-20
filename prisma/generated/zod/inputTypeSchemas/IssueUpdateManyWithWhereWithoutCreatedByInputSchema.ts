import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";
import { IssueUpdateManyMutationInputSchema } from "./IssueUpdateManyMutationInputSchema";
import { IssueUncheckedUpdateManyWithoutCreatedByInputSchema } from "./IssueUncheckedUpdateManyWithoutCreatedByInputSchema";

export const IssueUpdateManyWithWhereWithoutCreatedByInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutCreatedByInput> =
  z
    .object({
      where: z.lazy(() => IssueScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateManyMutationInputSchema),
        z.lazy(() => IssueUncheckedUpdateManyWithoutCreatedByInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutCreatedByInput>;

export default IssueUpdateManyWithWhereWithoutCreatedByInputSchema;
