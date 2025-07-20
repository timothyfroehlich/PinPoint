import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusCreateWithoutOrganizationInputSchema } from "./IssueStatusCreateWithoutOrganizationInputSchema";
import { IssueStatusUncheckedCreateWithoutOrganizationInputSchema } from "./IssueStatusUncheckedCreateWithoutOrganizationInputSchema";
import { IssueStatusCreateOrConnectWithoutOrganizationInputSchema } from "./IssueStatusCreateOrConnectWithoutOrganizationInputSchema";
import { IssueStatusCreateManyOrganizationInputEnvelopeSchema } from "./IssueStatusCreateManyOrganizationInputEnvelopeSchema";
import { IssueStatusWhereUniqueInputSchema } from "./IssueStatusWhereUniqueInputSchema";

export const IssueStatusUncheckedCreateNestedManyWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUncheckedCreateNestedManyWithoutOrganizationInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema),
          z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema).array(),
          z.lazy(
            () => IssueStatusUncheckedCreateWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueStatusUncheckedCreateWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(
            () => IssueStatusCreateOrConnectWithoutOrganizationInputSchema,
          ),
          z
            .lazy(
              () => IssueStatusCreateOrConnectWithoutOrganizationInputSchema,
            )
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => IssueStatusCreateManyOrganizationInputEnvelopeSchema)
        .optional(),
      connect: z
        .union([
          z.lazy(() => IssueStatusWhereUniqueInputSchema),
          z.lazy(() => IssueStatusWhereUniqueInputSchema).array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUncheckedCreateNestedManyWithoutOrganizationInput>;

export default IssueStatusUncheckedCreateNestedManyWithoutOrganizationInputSchema;
