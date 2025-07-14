import { modelCoreRouter } from "./model.core";
import { modelOpdbRouter } from "./model.opdb";

import { createTRPCRouter } from "~/server/api/trpc";

export const modelRouter = createTRPCRouter({
  ...modelCoreRouter,
  ...modelOpdbRouter,
});
