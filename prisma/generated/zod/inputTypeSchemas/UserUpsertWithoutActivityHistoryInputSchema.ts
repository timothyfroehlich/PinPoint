import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserUpdateWithoutActivityHistoryInputSchema } from "./UserUpdateWithoutActivityHistoryInputSchema";
import { UserUncheckedUpdateWithoutActivityHistoryInputSchema } from "./UserUncheckedUpdateWithoutActivityHistoryInputSchema";
import { UserCreateWithoutActivityHistoryInputSchema } from "./UserCreateWithoutActivityHistoryInputSchema";
import { UserUncheckedCreateWithoutActivityHistoryInputSchema } from "./UserUncheckedCreateWithoutActivityHistoryInputSchema";
import { UserWhereInputSchema } from "./UserWhereInputSchema";

export const UserUpsertWithoutActivityHistoryInputSchema: z.ZodType<Prisma.UserUpsertWithoutActivityHistoryInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => UserUpdateWithoutActivityHistoryInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutActivityHistoryInputSchema),
      ]),
      create: z.union([
        z.lazy(() => UserCreateWithoutActivityHistoryInputSchema),
        z.lazy(() => UserUncheckedCreateWithoutActivityHistoryInputSchema),
      ]),
      where: z.lazy(() => UserWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpsertWithoutActivityHistoryInput>;

export default UserUpsertWithoutActivityHistoryInputSchema;
