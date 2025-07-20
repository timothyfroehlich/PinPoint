import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutMachineInputSchema } from "./IssueUpdateWithoutMachineInputSchema";
import { IssueUncheckedUpdateWithoutMachineInputSchema } from "./IssueUncheckedUpdateWithoutMachineInputSchema";
import { IssueCreateWithoutMachineInputSchema } from "./IssueCreateWithoutMachineInputSchema";
import { IssueUncheckedCreateWithoutMachineInputSchema } from "./IssueUncheckedCreateWithoutMachineInputSchema";

export const IssueUpsertWithWhereUniqueWithoutMachineInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutMachineInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueUpdateWithoutMachineInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutMachineInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueCreateWithoutMachineInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutMachineInput>;

export default IssueUpsertWithWhereUniqueWithoutMachineInputSchema;
