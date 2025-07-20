import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutMachineInputSchema } from "./IssueCreateWithoutMachineInputSchema";
import { IssueUncheckedCreateWithoutMachineInputSchema } from "./IssueUncheckedCreateWithoutMachineInputSchema";
import { IssueCreateOrConnectWithoutMachineInputSchema } from "./IssueCreateOrConnectWithoutMachineInputSchema";
import { IssueCreateManyMachineInputEnvelopeSchema } from "./IssueCreateManyMachineInputEnvelopeSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";

export const IssueUncheckedCreateNestedManyWithoutMachineInputSchema: z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutMachineInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutMachineInputSchema),
          z.lazy(() => IssueCreateWithoutMachineInputSchema).array(),
          z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutMachineInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueCreateOrConnectWithoutMachineInputSchema),
          z.lazy(() => IssueCreateOrConnectWithoutMachineInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueCreateManyMachineInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutMachineInput>;

export default IssueUncheckedCreateNestedManyWithoutMachineInputSchema;
