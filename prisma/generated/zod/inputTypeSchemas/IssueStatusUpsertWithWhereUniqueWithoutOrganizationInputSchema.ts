import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueStatusWhereUniqueInputSchema } from "./IssueStatusWhereUniqueInputSchema";
import { IssueStatusUpdateWithoutOrganizationInputSchema } from "./IssueStatusUpdateWithoutOrganizationInputSchema";
import { IssueStatusUncheckedUpdateWithoutOrganizationInputSchema } from "./IssueStatusUncheckedUpdateWithoutOrganizationInputSchema";
import { IssueStatusCreateWithoutOrganizationInputSchema } from "./IssueStatusCreateWithoutOrganizationInputSchema";
import { IssueStatusUncheckedCreateWithoutOrganizationInputSchema } from "./IssueStatusUncheckedCreateWithoutOrganizationInputSchema";

export const IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUpsertWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => IssueStatusWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueStatusUpdateWithoutOrganizationInputSchema),
        z.lazy(() => IssueStatusUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueStatusCreateWithoutOrganizationInputSchema),
        z.lazy(() => IssueStatusUncheckedCreateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUpsertWithWhereUniqueWithoutOrganizationInput>;

export default IssueStatusUpsertWithWhereUniqueWithoutOrganizationInputSchema;
