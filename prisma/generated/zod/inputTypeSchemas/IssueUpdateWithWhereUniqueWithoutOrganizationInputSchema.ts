import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutOrganizationInputSchema } from "./IssueUpdateWithoutOrganizationInputSchema";
import { IssueUncheckedUpdateWithoutOrganizationInputSchema } from "./IssueUncheckedUpdateWithoutOrganizationInputSchema";

export const IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateWithoutOrganizationInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutOrganizationInput>;

export default IssueUpdateWithWhereUniqueWithoutOrganizationInputSchema;
