import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";
import { OrganizationUpdateWithoutAttachmentsInputSchema } from "./OrganizationUpdateWithoutAttachmentsInputSchema";
import { OrganizationUncheckedUpdateWithoutAttachmentsInputSchema } from "./OrganizationUncheckedUpdateWithoutAttachmentsInputSchema";

export const OrganizationUpdateToOneWithWhereWithoutAttachmentsInputSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutAttachmentsInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => OrganizationUpdateWithoutAttachmentsInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutAttachmentsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutAttachmentsInput>;

export default OrganizationUpdateToOneWithWhereWithoutAttachmentsInputSchema;
