import "server-only";

import type { User } from "@supabase/supabase-js";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import type { z } from "zod";

import { serverActionError } from "~/lib/observability/report-error";
import { getUserAccessLevel } from "~/lib/permissions/access";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import type { AccessLevel } from "~/lib/permissions/matrix";
import { err, type Result } from "~/lib/result";
import { createClient } from "~/lib/supabase/server";

export type PermissionId = Parameters<typeof checkPermission>[0];

export type ProtectedActionErrorCode =
  "UNAUTHORIZED" | "VALIDATION_ERROR" | "FORBIDDEN" | "SERVER";

export type ProtectedActionResult<
  TOutput,
  TError extends string = never,
> = Result<TOutput, ProtectedActionErrorCode | TError>;

export interface ActionContext {
  user: User;
  accessLevel: AccessLevel;
}

export interface ProtectedActionOptions<
  TInput,
  TOutput,
  TError extends string = never,
> {
  /** Stable operation name attached to unexpected-error reports. */
  actionName?: string;
  schema?: z.ZodType<TInput>;
  permission?:
    | PermissionId
    | ((
        input: TInput,
        context: ActionContext
      ) =>
        | {
            permission: PermissionId;
            ownershipContext?: OwnershipContext;
          }
        | Promise<{
            permission: PermissionId;
            ownershipContext?: OwnershipContext;
          }>);
  handler: (
    input: TInput,
    context: ActionContext
  ) => Promise<Result<TOutput, TError>>;
}

/**
 * Wrap a Server Action in PinPoint's authentication, validation, permission,
 * redirect, and unexpected-error handling pipeline.
 */
export function createProtectedAction<
  TInput,
  TOutput,
  TError extends string = never,
>(
  options: ProtectedActionOptions<TInput, TOutput, TError>
): (input: TInput) => Promise<ProtectedActionResult<TOutput, TError>> {
  return async function protectedAction(
    rawInput: TInput
  ): Promise<ProtectedActionResult<TOutput, TError>> {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return err("UNAUTHORIZED", "Unauthorized. Please log in.");
      }

      let input = rawInput;
      if (options.schema) {
        const validation = options.schema.safeParse(rawInput);
        if (!validation.success) {
          return err("VALIDATION_ERROR", validation.error.message);
        }
        input = validation.data;
      }

      const accessLevel = await getUserAccessLevel(user.id);
      const context: ActionContext = { user, accessLevel };

      if (options.permission) {
        const requirement =
          typeof options.permission === "function"
            ? await options.permission(input, context)
            : { permission: options.permission };

        if (
          !checkPermission(
            requirement.permission,
            accessLevel,
            requirement.ownershipContext
          )
        ) {
          return err("FORBIDDEN", "Forbidden: Insufficient permissions.");
        }
      }

      return await options.handler(input, context);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      return serverActionError(
        error,
        "SERVER",
        "An unexpected error occurred.",
        { action: options.actionName ?? "createProtectedAction" }
      );
    }
  };
}
