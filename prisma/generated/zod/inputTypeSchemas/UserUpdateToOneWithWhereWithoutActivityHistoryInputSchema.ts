import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserUpdateWithoutActivityHistoryInputSchema } from "./UserUpdateWithoutActivityHistoryInputSchema";
import { UserUncheckedUpdateWithoutActivityHistoryInputSchema } from "./UserUncheckedUpdateWithoutActivityHistoryInputSchema";

export const UserUpdateToOneWithWhereWithoutActivityHistoryInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutActivityHistoryInput> =
  z
    .object({
      where: z.lazy(() => UserWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => UserUpdateWithoutActivityHistoryInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutActivityHistoryInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutActivityHistoryInput>;

export default UserUpdateToOneWithWhereWithoutActivityHistoryInputSchema;
