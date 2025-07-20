import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";
import { IssueUpdateManyMutationInputSchema } from "./IssueUpdateManyMutationInputSchema";
import { IssueUncheckedUpdateManyWithoutAssignedToInputSchema } from "./IssueUncheckedUpdateManyWithoutAssignedToInputSchema";

export const IssueUpdateManyWithWhereWithoutAssignedToInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutAssignedToInput> =
  z
    .object({
      where: z.lazy(() => IssueScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateManyMutationInputSchema),
        z.lazy(() => IssueUncheckedUpdateManyWithoutAssignedToInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutAssignedToInput>;

export default IssueUpdateManyWithWhereWithoutAssignedToInputSchema;
