import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutPriorityInputSchema } from "./IssueCreateWithoutPriorityInputSchema";
import { IssueUncheckedCreateWithoutPriorityInputSchema } from "./IssueUncheckedCreateWithoutPriorityInputSchema";
import { IssueCreateOrConnectWithoutPriorityInputSchema } from "./IssueCreateOrConnectWithoutPriorityInputSchema";
import { IssueCreateManyPriorityInputEnvelopeSchema } from "./IssueCreateManyPriorityInputEnvelopeSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";

export const IssueUncheckedCreateNestedManyWithoutPriorityInputSchema: z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutPriorityInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutPriorityInputSchema),
          z.lazy(() => IssueCreateWithoutPriorityInputSchema).array(),
          z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema).array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => IssueCreateOrConnectWithoutPriorityInputSchema),
          z.lazy(() => IssueCreateOrConnectWithoutPriorityInputSchema).array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueCreateManyPriorityInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueWhereUniqueInputSchema),
          z.lazy(() => IssueWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUncheckedCreateNestedManyWithoutPriorityInput>;

export default IssueUncheckedCreateNestedManyWithoutPriorityInputSchema;
