/**
 * tRPC Types (Centralized)
 *
 * tRPC-related type utilities and inference helpers.
 * Moved here to comply with CORE-TS-001 type centralization.
 */

import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "~/server/api/root";

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;