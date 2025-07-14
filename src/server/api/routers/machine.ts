import { machineCoreRouter } from "./machine.core";
import { machineLocationRouter } from "./machine.location";
import { machineOwnerRouter } from "./machine.owner";

import { createTRPCRouter } from "~/server/api/trpc";

export const machineRouter = createTRPCRouter({
  ...machineCoreRouter,
  ...machineLocationRouter,
  ...machineOwnerRouter,
});
