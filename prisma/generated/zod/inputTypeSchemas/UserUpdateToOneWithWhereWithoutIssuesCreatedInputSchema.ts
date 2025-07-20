import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserUpdateWithoutIssuesCreatedInputSchema } from "./UserUpdateWithoutIssuesCreatedInputSchema";
import { UserUncheckedUpdateWithoutIssuesCreatedInputSchema } from "./UserUncheckedUpdateWithoutIssuesCreatedInputSchema";

export const UserUpdateToOneWithWhereWithoutIssuesCreatedInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutIssuesCreatedInput> =
  z
    .object({
      where: z.lazy(() => UserWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => UserUpdateWithoutIssuesCreatedInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutIssuesCreatedInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutIssuesCreatedInput>;

export default UserUpdateToOneWithWhereWithoutIssuesCreatedInputSchema;
