import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserUpdateWithoutDeletedCommentsInputSchema } from "./UserUpdateWithoutDeletedCommentsInputSchema";
import { UserUncheckedUpdateWithoutDeletedCommentsInputSchema } from "./UserUncheckedUpdateWithoutDeletedCommentsInputSchema";
import { UserCreateWithoutDeletedCommentsInputSchema } from "./UserCreateWithoutDeletedCommentsInputSchema";
import { UserUncheckedCreateWithoutDeletedCommentsInputSchema } from "./UserUncheckedCreateWithoutDeletedCommentsInputSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const UserUpsertWithoutDeletedCommentsInputSchema: z.ZodType<Prisma.UserUpsertWithoutDeletedCommentsInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => UserUpdateWithoutDeletedCommentsInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutDeletedCommentsInputSchema),
      ]),
      create: z.union([
        z.lazy(() => UserCreateWithoutDeletedCommentsInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutDeletedCommentsInputSchema),
      ]),
      where: z.lazy(() => UserWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpsertWithoutDeletedCommentsInput>;

export default UserUpsertWithoutDeletedCommentsInputSchema;
