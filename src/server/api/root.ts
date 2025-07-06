import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { gameTitleRouter } from "~/server/api/routers/gameTitle";
import { locationRouter } from "~/server/api/routers/location";
import { gameInstanceRouter } from "~/server/api/routers/gameInstance";
import { userRouter } from "~/server/api/routers/user";
import { issueRouter } from "~/server/api/routers/issue";
import { issueStatusRouter } from "~/server/api/routers/issueStatus";
import { roomRouter } from "~/server/api/routers/room";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  gameTitle: gameTitleRouter,
  location: locationRouter,
  gameInstance: gameInstanceRouter,
  user: userRouter,
  issue: issueRouter,
  issueStatus: issueStatusRouter,
  room: roomRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
