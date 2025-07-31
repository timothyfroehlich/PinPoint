import { organizationProcedure } from "./trpc.base";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";
import type { Session } from "next-auth";

import { requirePermissionForSession } from "~/server/auth/permissions";

/**
 * Convert Supabase user to NextAuth-compatible session for permission system
 * This is a temporary compatibility layer during the Supabase migration
 */
function supabaseUserToSession(user: PinPointSupabaseUser): Session {
  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata["name"] as string | undefined,
      image: user.user_metadata["avatar_url"] as string | undefined,
    } as Session["user"] & { organizationId?: string },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  } as Session;
}

export const issueViewProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "issue:view",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueCreateProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "issue:create",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "issue:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueDeleteProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "issue:delete",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueAssignProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "issue:assign",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const attachmentCreateProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(opts.ctx.user);
    await requirePermissionForSession(
      session,
      "attachment:create",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const attachmentDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(opts.ctx.user);
    await requirePermissionForSession(
      session,
      "attachment:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const machineEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "machine:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const machineDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(opts.ctx.user);
    await requirePermissionForSession(
      session,
      "machine:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const locationEditProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "location:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const locationDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(opts.ctx.user);
    await requirePermissionForSession(
      session,
      "location:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const organizationManageProcedure = organizationProcedure.use(
  async (opts) => {
    const session = supabaseUserToSession(opts.ctx.user);
    await requirePermissionForSession(
      session,
      "organization:manage",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const roleManageProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "role:manage",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const userManageProcedure = organizationProcedure.use(async (opts) => {
  const session = supabaseUserToSession(opts.ctx.user);
  await requirePermissionForSession(
    session,
    "user:manage",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

/**
 * @deprecated Use specific permission procedures instead
 */
export const adminProcedure = organizationManageProcedure;
