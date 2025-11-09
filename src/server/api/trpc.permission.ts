import { organizationProcedure } from "./trpc.base";

import type { PinPointSupabaseUser } from "~/lib/types";
import { METADATA_KEYS } from "~/lib/constants/entity-ui";

// Legacy session type for backward compatibility
type Session = {
  user: {
    id: string;
    email?: string | undefined;
    name?: string | undefined;
    image?: string | undefined;
    organizationId?: string | undefined;
    [key: string]: unknown;
  };
  expires: string;
} | null;

import {
  requirePermissionForSession,
  getUserPermissionsForSession,
} from "~/server/auth/permissions";
import { TRPCError } from "@trpc/server";

/**
 * Convert Supabase user to NextAuth-compatible session for permission system
 * This is a temporary compatibility layer during the Supabase migration
 *
 * UPDATED FOR RLS: organizationId now comes from context, not user metadata
 */
function supabaseUserToSession(
  user: PinPointSupabaseUser,
  organizationId?: string,
): Session {
  // Handle test contexts where metadata might be undefined despite types
  // This is a runtime safety check for test mocks
  const userMetadata =
    (user.user_metadata as Record<string, unknown> | undefined) ?? {};
  const appMetadata =
    (user.app_metadata as Record<string, unknown> | undefined) ?? {};

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: userMetadata["name"] as string | undefined,
      image: userMetadata["avatar_url"] as string | undefined,
      // Use organizationId from RLS context (preferred) or fallback to app_metadata
      organizationId:
        organizationId ??
        (appMetadata[METADATA_KEYS.ORGANIZATION_ID] as string | undefined),
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  };
}

export const issueViewProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "issue:view", opts.ctx.db);
  return opts.next();
});

export const issueCreateProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  const permissions = await getUserPermissionsForSession(session, opts.ctx.db);
  if (
    !permissions.includes("issue:create_basic") &&
    !permissions.includes("issue:create_full")
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Permission required: issue:create_basic or issue:create_full`,
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      userPermissions: permissions,
    },
  });
});

export const issueEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "issue:edit", opts.ctx.db);
  return opts.next();
});

export const issueDeleteProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "issue:delete", opts.ctx.db);
  return opts.next();
});

export const issueAssignProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "issue:assign", opts.ctx.db);
  return opts.next();
});

export const attachmentCreateProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(
      opts.ctx.user,
      opts.ctx.organizationId,
    );
    await requirePermissionForSession(
      session,
      "attachment:create",
      opts.ctx.db,
    );
    return opts.next();
  },
);

export const attachmentDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(
      opts.ctx.user,
      opts.ctx.organizationId,
    );
    await requirePermissionForSession(
      session,
      "attachment:delete",
      opts.ctx.db,
    );
    return opts.next();
  },
);

export const machineEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "machine:edit", opts.ctx.db);
  return opts.next();
});

export const machineDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(
      opts.ctx.user,
      opts.ctx.organizationId,
    );
    await requirePermissionForSession(session, "machine:delete", opts.ctx.db);
    return opts.next();
  },
);

export const locationEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "location:edit", opts.ctx.db);
  return opts.next();
});

export const locationDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(
      opts.ctx.user,
      opts.ctx.organizationId,
    );
    await requirePermissionForSession(session, "location:delete", opts.ctx.db);
    return opts.next();
  },
);

export const organizationManageProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(
      opts.ctx.user,
      opts.ctx.organizationId,
    );
    await requirePermissionForSession(
      session,
      "organization:manage",
      opts.ctx.db,
    );
    return opts.next();
  },
);

export const roleManageProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "role:manage", opts.ctx.db);
  return opts.next();
});

export const userManageProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user, opts.ctx.organizationId);
  await requirePermissionForSession(session, "user:manage", opts.ctx.db);
  return opts.next();
});

/**
 * @deprecated Use specific permission procedures instead
 */
export const adminProcedure = organizationManageProcedure;
