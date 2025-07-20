import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { PriorityCreateWithoutOrganizationInputSchema } from "./PriorityCreateWithoutOrganizationInputSchema";
import { PriorityUncheckedCreateWithoutOrganizationInputSchema } from "./PriorityUncheckedCreateWithoutOrganizationInputSchema";
import { PriorityCreateOrConnectWithoutOrganizationInputSchema } from "./PriorityCreateOrConnectWithoutOrganizationInputSchema";
import { PriorityCreateManyOrganizationInputEnvelopeSchema } from "./PriorityCreateManyOrganizationInputEnvelopeSchema";
import { PriorityWhereUniqueInputSchema } from "./PriorityWhereUniqueInputSchema";

export const PriorityUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUncheckedCreateNestedManyWithoutOrganizationInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => PriorityCreateWithoutOrganizationInputSchema),
          z.lazy(() => PriorityCreateWithoutOrganizationInputSchema).array(),
          z.lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema),
          z
            .lazy(() => PriorityUncheckedCreateWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => PriorityCreateOrConnectWithoutOrganizationInputSchema),
          z
            .lazy(() => PriorityCreateOrConnectWithoutOrganizationInputSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => PriorityCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => PriorityWhereUniqueInputSchema),
          z.lazy(() => PriorityWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PriorityUncheckedCreateNestedManyWithoutOrganizationInput>;

export default PriorityUncheckedCreateNestedManyWithoutOrganizationInputSchema;
