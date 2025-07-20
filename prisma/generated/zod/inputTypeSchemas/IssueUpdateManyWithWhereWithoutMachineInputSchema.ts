import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueScalarWhereInputSchema } from "./IssueScalarWhereInputSchema";
import { IssueUpdateManyMutationInputSchema } from "./IssueUpdateManyMutationInputSchema";
import { IssueUncheckedUpdateManyWithoutMachineInputSchema } from "./IssueUncheckedUpdateManyWithoutMachineInputSchema";

export const IssueUpdateManyWithWhereWithoutMachineInputSchema: z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutMachineInput> =
  z
    .object({
      where: z.lazy(() => IssueScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateManyMutationInputSchema),
        z.lazy(() => IssueUncheckedUpdateManyWithoutMachineInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateManyWithWhereWithoutMachineInput>;

export default IssueUpdateManyWithWhereWithoutMachineInputSchema;
