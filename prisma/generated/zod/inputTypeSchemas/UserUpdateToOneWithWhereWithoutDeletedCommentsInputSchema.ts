import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserUpdateWithoutDeletedCommentsInputSchema } from "./UserUpdateWithoutDeletedCommentsInputSchema";
import { UserUncheckedUpdateWithoutDeletedCommentsInputSchema } from "./UserUncheckedUpdateWithoutDeletedCommentsInputSchema";

export const UserUpdateToOneWithWhereWithoutDeletedCommentsInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutDeletedCommentsInput> =
  z
    .object({
      where: z.lazy(() => UserWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => UserUpdateWithoutDeletedCommentsInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutDeletedCommentsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutDeletedCommentsInput>;

export default UserUpdateToOneWithWhereWithoutDeletedCommentsInputSchema;
