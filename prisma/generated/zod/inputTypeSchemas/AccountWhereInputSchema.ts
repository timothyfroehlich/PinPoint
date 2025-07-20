import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFilterSchema } from "./StringFilterSchema";
import { StringNullableFilterSchema } from "./StringNullableFilterSchema";
import { IntNullableFilterSchema } from "./IntNullableFilterSchema";
import { UserScalarRelationFilterSchema } from "./UserScalarRelationFilterSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const AccountWhereInputSchema: z.ZodType<Prisma.AccountWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => AccountWhereInputSchema),
        z.lazy(() => AccountWhereInputSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => AccountWhereInputSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => AccountWhereInputSchema),
        z.lazy(() => AccountWhereInputSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    userId: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    type: z.union([z.lazy(() => StringFilterSchema), z.string()]).optional(),
    provider: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    providerAccountId: z
      .union([z.lazy(() => StringFilterSchema), z.string()])
      .optional(),
    refresh_token: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    access_token: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    expires_at: z
      .union([z.lazy(() => IntNullableFilterSchema), z.number()])
      .optional()
      .nullable(),
    token_type: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    scope: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    id_token: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    session_state: z
      .union([z.lazy(() => StringNullableFilterSchema), z.string()])
      .optional()
      .nullable(),
    user: z
      .union([
        z.lazy(() => UserScalarRelationFilterSchema),
        z.lazy(() => UserWhereInputSchema),
      ])
      .optional(),
  })
  .strict() as z.ZodType<Prisma.AccountWhereInput>;

export default AccountWhereInputSchema;
