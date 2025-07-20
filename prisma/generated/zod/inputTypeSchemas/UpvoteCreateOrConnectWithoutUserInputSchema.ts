import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UpvoteWhereUniqueInputSchema } from "./UpvoteWhereUniqueInputSchema";
import { UpvoteCreateWithoutUserInputSchema } from "./UpvoteCreateWithoutUserInputSchema";
import { UpvoteUncheckedCreateWithoutUserInputSchema } from "./UpvoteUncheckedCreateWithoutUserInputSchema";

export const UpvoteCreateOrConnectWithoutUserInputSchema: z.ZodType<Prisma.UpvoteCreateOrConnectWithoutUserInput> =
  z
    .object({
      where: z.lazy(() => UpvoteWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => UpvoteCreateWithoutUserInputSchema),
        z.lazy(() => UpvoteUncheckedCreateWithoutUserInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UpvoteCreateOrConnectWithoutUserInput>;

export default UpvoteCreateOrConnectWithoutUserInputSchema;
