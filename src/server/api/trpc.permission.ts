import { organizationProcedure } from "./trpc.base";

import { requirePermissionForSession } from "~/server/auth/permissions";

export const issueViewProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:view",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueCreateProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:create",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueEditProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueDeleteProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:delete",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const issueAssignProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "issue:assign",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const attachmentCreateProcedure = organizationProcedure.use(
  async (opts) => {
    await requirePermissionForSession(
      opts.ctx.session,
      "attachment:create",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const attachmentDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    await requirePermissionForSession(
      opts.ctx.session,
      "attachment:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const machineEditProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "machine:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const machineDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    await requirePermissionForSession(
      opts.ctx.session,
      "machine:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const locationEditProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "location:edit",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const locationDeleteProcedure = organizationProcedure.use(
  async (opts) => {
    await requirePermissionForSession(
      opts.ctx.session,
      "location:delete",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const organizationManageProcedure = organizationProcedure.use(
  async (opts) => {
    await requirePermissionForSession(
      opts.ctx.session,
      "organization:manage",
      opts.ctx.db,
      opts.ctx.organization.id,
    );
    return opts.next();
  },
);

export const roleManageProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
    "role:manage",
    opts.ctx.db,
    opts.ctx.organization.id,
  );
  return opts.next();
});

export const userManageProcedure = organizationProcedure.use(async (opts) => {
  await requirePermissionForSession(
    opts.ctx.session,
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
