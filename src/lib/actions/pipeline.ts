import "server-only";

import type { User } from "@supabase/supabase-js";
import type { z } from "zod";

import { serverActionError } from "~/lib/observability/report-error";
import { getUserAccessLevel } from "~/lib/permissions/access";
import {
  checkPermission,
  type OwnershipContext,
} from "~/lib/permissions/helpers";
import type { AccessLevel } from "~/lib/permissions/matrix";
import { err, ok, type Result } from "~/lib/result";
import { createClient } from "~/lib/supabase/server";

import { rethrowIfRedirect } from "./redirect";

export type PermissionId = Parameters<typeof checkPermission>[0];

export type ProtectedActionErrorCode =
  "UNAUTHORIZED" | "VALIDATION" | "FORBIDDEN" | "SERVER";

/** A signed-out caller is never UNAUTHORIZED; the permission check decides. */
export type PublicActionErrorCode = Exclude<
  ProtectedActionErrorCode,
  "UNAUTHORIZED"
>;

export type ProtectedActionResult<
  TOutput,
  TError extends string = never,
> = Result<TOutput, ProtectedActionErrorCode | TError>;

export type PublicActionResult<TOutput, TError extends string = never> = Result<
  TOutput,
  PublicActionErrorCode | TError
>;

/** The caller, as every pipeline stage after authentication sees it. */
export interface ActionContext<TUser extends User | null = User> {
  user: TUser;
  accessLevel: AccessLevel;
}

/** `createPublicAction` runs for signed-out callers too. */
export type PublicActionContext = ActionContext<User | null>;

/** The context the permission callback and handler see: `load`'s value is `resource`. */
export type ResourceContext<TContext, TResource> = TContext & {
  resource: TResource;
};

export interface PermissionRequirement {
  permission: PermissionId;
  ownershipContext?: OwnershipContext;
}

/** Options every action has, whatever its input and resource shape. */
export interface ActionStageOptions<
  TContext,
  TInput,
  TResource,
  TOutput,
  TError extends string,
> {
  /** Stable operation name attached to unexpected-error reports. */
  actionName?: string;
  permission?:
    | PermissionId
    | ((
        input: TInput,
        context: ResourceContext<TContext, TResource>
      ) => PermissionRequirement | Promise<PermissionRequirement>);
  /** FORBIDDEN message; defaults to "Forbidden: Insufficient permissions." */
  forbiddenMessage?: string;
  /** SERVER message for an unexpected throw; defaults to "An unexpected error occurred." */
  serverErrorMessage?: string;
  handler: (
    input: TInput,
    context: ResourceContext<TContext, TResource>
  ) => Promise<Result<TOutput, TError>>;
}

/**
 * Load the resource the permission check and handler need, after validation
 * and before the permission check. An `err` (typically NOT_FOUND) ends the
 * action with that Result.
 */
export interface WithLoad<
  TContext,
  TInput,
  TResource,
  TLoadError extends string,
> {
  load: (
    input: TInput,
    context: TContext
  ) => Promise<Result<TResource, TLoadError>>;
}

export interface WithoutLoad {
  load?: undefined;
}

/**
 * Validate the input with `schema`. `mapInput` turns the raw argument (for
 * example a FormData) into the value the schema parses; without it the action
 * takes the schema's input type.
 */
export interface WithSchema<TSchema extends z.ZodType, TRaw> {
  schema: TSchema;
  mapInput?: (raw: TRaw) => unknown;
}

export interface WithoutSchema {
  schema?: undefined;
  mapInput?: undefined;
}

type Staged<
  TContext,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
> =
  | (ActionStageOptions<TContext, TInput, TResource, TOutput, TError> &
      WithLoad<TContext, TInput, TResource, TLoadError>)
  | (ActionStageOptions<TContext, TInput, undefined, TOutput, TError> &
      WithoutLoad);

/** Every option shape, narrowed on `schema` and `load` inside the pipeline. */
type AnyActionOptions<
  TContext,
  TRaw,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
> =
  | ({ schema: z.ZodType<TInput>; mapInput?: (raw: TRaw) => unknown } & Staged<
      TContext,
      TInput,
      TResource,
      TOutput,
      TError,
      TLoadError
    >)
  | (WithoutSchema &
      Staged<TContext, TRaw, TResource, TOutput, TError, TLoadError>);

interface Authentication<TUser extends User | null, TAuthError extends string> {
  resolveUser: (user: User | null) => Result<TUser, TAuthError>;
  defaultActionName: string;
}

const requireUser: Authentication<User, "UNAUTHORIZED"> = {
  resolveUser: (user) =>
    user ? ok(user) : err("UNAUTHORIZED", "Unauthorized. Please log in."),
  defaultActionName: "createProtectedAction",
};

const allowSignedOut: Authentication<User | null, never> = {
  resolveUser: (user) => ok(user),
  defaultActionName: "createPublicAction",
};

async function authorizeAndRun<
  TUser extends User | null,
  TInput,
  TResource,
  TOutput,
  TError extends string,
>(
  input: TInput,
  options: ActionStageOptions<
    ActionContext<TUser>,
    TInput,
    TResource,
    TOutput,
    TError
  >,
  context: ResourceContext<ActionContext<TUser>, TResource>
): Promise<Result<TOutput, "FORBIDDEN" | TError>> {
  if (options.permission) {
    const requirement =
      typeof options.permission === "function"
        ? await options.permission(input, context)
        : { permission: options.permission };

    if (
      !checkPermission(
        requirement.permission,
        context.accessLevel,
        requirement.ownershipContext
      )
    ) {
      return err(
        "FORBIDDEN",
        options.forbiddenMessage ?? "Forbidden: Insufficient permissions."
      );
    }
  }

  return await options.handler(input, context);
}

async function runStages<
  TUser extends User | null,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
>(
  input: TInput,
  options: Staged<
    ActionContext<TUser>,
    TInput,
    TResource,
    TOutput,
    TError,
    TLoadError
  >,
  user: TUser
): Promise<Result<TOutput, "FORBIDDEN" | TError | TLoadError>> {
  const accessLevel: AccessLevel = user
    ? await getUserAccessLevel(user.id)
    : "unauthenticated";
  const context: ActionContext<TUser> = { user, accessLevel };

  if (options.load === undefined) {
    return await authorizeAndRun(input, options, {
      ...context,
      resource: undefined,
    });
  }

  const loaded = await options.load(input, context);
  if (!loaded.ok) {
    return loaded;
  }
  return await authorizeAndRun(input, options, {
    ...context,
    resource: loaded.value,
  });
}

function buildAction<
  TUser extends User | null,
  TAuthError extends string,
  TRaw,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
>(
  options: AnyActionOptions<
    ActionContext<TUser>,
    TRaw,
    TInput,
    TResource,
    TOutput,
    TError,
    TLoadError
  >,
  authentication: Authentication<TUser, TAuthError>
): (
  raw: TRaw
) => Promise<
  Result<TOutput, TAuthError | PublicActionErrorCode | TError | TLoadError>
> {
  return async function pipelineAction(raw) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const resolved = authentication.resolveUser(user);
      if (!resolved.ok) {
        return resolved;
      }

      if (options.schema === undefined) {
        return await runStages(raw, options, resolved.value);
      }

      const validation = options.schema.safeParse(
        options.mapInput ? options.mapInput(raw) : raw
      );
      if (!validation.success) {
        return err(
          "VALIDATION",
          validation.error.issues[0]?.message ?? "Invalid input"
        );
      }
      return await runStages(validation.data, options, resolved.value);
    } catch (error) {
      rethrowIfRedirect(error);

      return serverActionError(
        error,
        "SERVER",
        options.serverErrorMessage ?? "An unexpected error occurred.",
        { action: options.actionName ?? authentication.defaultActionName }
      );
    }
  };
}

/**
 * Wrap a Server Action in PinPoint's pipeline: authenticate (signed-out callers
 * get UNAUTHORIZED), validate with `schema`, `load` the resource, check
 * `permission`, run `handler`, rethrow redirects, and report anything thrown
 * as SERVER. See `.agents/skills/pinpoint-ui` § Server Actions (CORE-ARCH-013).
 */
export function createProtectedAction<
  TSchema extends z.ZodType,
  TResource,
  TOutput,
  TError extends string = never,
  TLoadError extends string = never,
  TRaw = z.input<TSchema>,
>(
  options: WithSchema<TSchema, TRaw> &
    WithLoad<ActionContext, z.output<TSchema>, TResource, TLoadError> &
    ActionStageOptions<
      ActionContext,
      z.output<TSchema>,
      TResource,
      TOutput,
      TError
    >
): (raw: TRaw) => Promise<ProtectedActionResult<TOutput, TError | TLoadError>>;
export function createProtectedAction<
  TSchema extends z.ZodType,
  TOutput,
  TError extends string = never,
  TRaw = z.input<TSchema>,
>(
  options: WithSchema<TSchema, TRaw> &
    WithoutLoad &
    ActionStageOptions<
      ActionContext,
      z.output<TSchema>,
      undefined,
      TOutput,
      TError
    >
): (raw: TRaw) => Promise<ProtectedActionResult<TOutput, TError>>;
export function createProtectedAction<
  TInput,
  TResource,
  TOutput,
  TError extends string = never,
  TLoadError extends string = never,
>(
  options: WithoutSchema &
    WithLoad<ActionContext, TInput, TResource, TLoadError> &
    ActionStageOptions<ActionContext, TInput, TResource, TOutput, TError>
): (
  input: TInput
) => Promise<ProtectedActionResult<TOutput, TError | TLoadError>>;
export function createProtectedAction<
  TInput,
  TOutput,
  TError extends string = never,
>(
  options: WithoutSchema &
    WithoutLoad &
    ActionStageOptions<ActionContext, TInput, undefined, TOutput, TError>
): (input: TInput) => Promise<ProtectedActionResult<TOutput, TError>>;
export function createProtectedAction<
  TRaw,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
>(
  options: AnyActionOptions<
    ActionContext,
    TRaw,
    TInput,
    TResource,
    TOutput,
    TError,
    TLoadError
  >
): (raw: TRaw) => Promise<ProtectedActionResult<TOutput, TError | TLoadError>> {
  return buildAction(options, requireUser);
}

/**
 * `createProtectedAction` for an action signed-out visitors may call (public
 * issue reporting): `context.user` is `null` for them and their access level
 * is "unauthenticated", so `permission` decides what they may do.
 */
export function createPublicAction<
  TSchema extends z.ZodType,
  TResource,
  TOutput,
  TError extends string = never,
  TLoadError extends string = never,
  TRaw = z.input<TSchema>,
>(
  options: WithSchema<TSchema, TRaw> &
    WithLoad<PublicActionContext, z.output<TSchema>, TResource, TLoadError> &
    ActionStageOptions<
      PublicActionContext,
      z.output<TSchema>,
      TResource,
      TOutput,
      TError
    >
): (raw: TRaw) => Promise<PublicActionResult<TOutput, TError | TLoadError>>;
export function createPublicAction<
  TSchema extends z.ZodType,
  TOutput,
  TError extends string = never,
  TRaw = z.input<TSchema>,
>(
  options: WithSchema<TSchema, TRaw> &
    WithoutLoad &
    ActionStageOptions<
      PublicActionContext,
      z.output<TSchema>,
      undefined,
      TOutput,
      TError
    >
): (raw: TRaw) => Promise<PublicActionResult<TOutput, TError>>;
export function createPublicAction<
  TInput,
  TResource,
  TOutput,
  TError extends string = never,
  TLoadError extends string = never,
>(
  options: WithoutSchema &
    WithLoad<PublicActionContext, TInput, TResource, TLoadError> &
    ActionStageOptions<PublicActionContext, TInput, TResource, TOutput, TError>
): (input: TInput) => Promise<PublicActionResult<TOutput, TError | TLoadError>>;
export function createPublicAction<
  TInput,
  TOutput,
  TError extends string = never,
>(
  options: WithoutSchema &
    WithoutLoad &
    ActionStageOptions<PublicActionContext, TInput, undefined, TOutput, TError>
): (input: TInput) => Promise<PublicActionResult<TOutput, TError>>;
export function createPublicAction<
  TRaw,
  TInput,
  TResource,
  TOutput,
  TError extends string,
  TLoadError extends string,
>(
  options: AnyActionOptions<
    PublicActionContext,
    TRaw,
    TInput,
    TResource,
    TOutput,
    TError,
    TLoadError
  >
): (raw: TRaw) => Promise<PublicActionResult<TOutput, TError | TLoadError>> {
  return buildAction(options, allowSignedOut);
}
