import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UserWhereInputSchema } from "./UserWhereInputSchema";
import { UserUpdateWithoutUpvotesInputSchema } from "./UserUpdateWithoutUpvotesInputSchema";
import { UserUncheckedUpdateWithoutUpvotesInputSchema } from "./UserUncheckedUpdateWithoutUpvotesInputSchema";

export const UserUpdateToOneWithWhereWithoutUpvotesInputSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutUpvotesInput> =
  z
    .object({
      where: z.lazy(() => UserWhereInputSchema).optional(),
      data: z.union([
        z.lazy(() => UserUpdateWithoutUpvotesInputSchema),
        z.lazy(() => UserUncheckedUpdateWithoutUpvotesInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutUpvotesInput>;

export default UserUpdateToOneWithWhereWithoutUpvotesInputSchema;
