import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { UpvoteWhereUniqueInputSchema } from "./UpvoteWhereUniqueInputSchema";
import { UpvoteUpdateWithoutIssueInputSchema } from "./UpvoteUpdateWithoutIssueInputSchema";
import { UpvoteUncheckedUpdateWithoutIssueInputSchema } from "./UpvoteUncheckedUpdateWithoutIssueInputSchema";

export const UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUpdateWithWhereUniqueWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => UpvoteWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => UpvoteUpdateWithoutIssueInputSchema),
        z.lazy(() => UpvoteUncheckedUpdateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.UpvoteUpdateWithWhereUniqueWithoutIssueInput>;

export default UpvoteUpdateWithWhereUniqueWithoutIssueInputSchema;
