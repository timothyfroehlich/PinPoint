import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusWhereUniqueInputSchema } from "./IssueStatusWhereUniqueInputSchema";
import { IssueStatusCreateWithoutOrganizationInputSchema } from "./IssueStatusCreateWithoutOrganizationInputSchema";
import { IssueStatusUncheckedCreateWithoutOrganizationInputSchema } from "./IssueStatusUncheckedCreateWithoutOrganizationInputSchema";

export const IssueStatusCreateOrConnectWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusCreateOrConnectWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => IssueStatusWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema),
        z.lazy(() => IssueStatusUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateOrConnectWithoutOrganizationInput>;

export default IssueStatusCreateOrConnectWithoutOrganizationInputSchema;
