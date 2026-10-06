import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { err, ok, type Result } from "~/lib/result";

const mocks = vi.hoisted(() => ({
  checkPermission: vi.fn(),
  getUser: vi.fn(),
  getUserAccessLevel: vi.fn(),
  serverActionError: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mocks.getUser },
    })
  ),
}));

vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: mocks.getUserAccessLevel,
}));

vi.mock("~/lib/permissions/helpers", () => ({
  checkPermission: mocks.checkPermission,
}));

vi.mock("~/lib/observability/report-error", () => ({
  serverActionError: mocks.serverActionError,
}));

import {
  createProtectedAction,
  createPublicAction,
  type PublicActionContext,
} from "./pipeline";

const USER = { id: "user-1" };

describe("createProtectedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.getUserAccessLevel.mockResolvedValue("member");
    mocks.checkPermission.mockReturnValue(true);
    mocks.serverActionError.mockImplementation(
      (error: unknown, code: string, message: string) => {
        void error;
        return err(code, message);
      }
    );
  });

  it("returns UNAUTHORIZED before profile lookup or handler execution", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({ handler });

    await expect(action(undefined)).resolves.toEqual(
      err("UNAUTHORIZED", "Unauthorized. Please log in.")
    );
    expect(mocks.getUserAccessLevel).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns the first VALIDATION issue without checking permission or running the handler", async () => {
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({
      schema: z.object({
        count: z.number().int().positive("Count must be positive"),
        name: z.string().min(1, "Name is required"),
      }),
      permission: "issues.watch",
      handler,
    });

    await expect(action({ count: -1, name: "" })).resolves.toEqual(
      err("VALIDATION", "Count must be positive")
    );
    expect(mocks.getUserAccessLevel).not.toHaveBeenCalled();
    expect(mocks.checkPermission).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("supports asynchronous ownership resolution in permission callbacks", async () => {
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({
      permission: async (input: { resourceId: string }, context) => {
        await Promise.resolve();
        return {
          permission: "machines.edit",
          ownershipContext: {
            userId: context.user.id,
            machineOwnerId: "owner-99",
          },
        };
      },
      handler,
    });

    const result = await action({ resourceId: "machine-1" });

    expect(result).toEqual(ok("done"));
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      "machines.edit",
      "member",
      { userId: "user-1", machineOwnerId: "owner-99" }
    );
    expect(handler).toHaveBeenCalled();
  });

  it("returns FORBIDDEN when an ownership-aware permission is denied", async () => {
    mocks.checkPermission.mockReturnValue(false);
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({
      permission: (input: { reporterId: string }, context) => ({
        permission: "comments.edit",
        ownershipContext: {
          userId: context.user.id,
          reporterId: input.reporterId,
        },
      }),
      handler,
    });

    await expect(action({ reporterId: "user-2" })).resolves.toEqual(
      err("FORBIDDEN", "Forbidden: Insufficient permissions.")
    );
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      "comments.edit",
      "member",
      { userId: "user-1", reporterId: "user-2" }
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs an authorized handler with validated input and action context", async () => {
    const handler = vi.fn((input: { name: string }, context) =>
      Promise.resolve(ok({ name: input.name, actorId: context.user.id }))
    );
    const action = createProtectedAction({
      schema: z.object({ name: z.string().trim().min(1) }),
      permission: "issues.watch",
      handler,
    });

    await expect(action({ name: "  Ada  " })).resolves.toEqual(
      ok({ name: "Ada", actorId: "user-1" })
    );
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      "issues.watch",
      "member",
      undefined
    );
    expect(handler).toHaveBeenCalledWith(
      { name: "Ada" },
      { user: USER, accessLevel: "member" }
    );
  });

  it("preserves a handler Result error", async () => {
    const handler = vi.fn(() =>
      Promise.resolve(err("CONFLICT", "Already changed"))
    );
    const action = createProtectedAction({ handler });

    await expect(action(undefined)).resolves.toEqual(
      err("CONFLICT", "Already changed")
    );
    expect(mocks.serverActionError).not.toHaveBeenCalled();
  });

  it("rethrows Next.js redirect errors without reporting them", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/target;307;",
    });
    const action = createProtectedAction({
      handler: () => Promise.reject(redirectError),
    });

    await expect(action(undefined)).rejects.toBe(redirectError);
    expect(mocks.serverActionError).not.toHaveBeenCalled();
  });

  it("reports unexpected errors and returns a generic SERVER error", async () => {
    const failure = new Error("database detail");
    const action = createProtectedAction({
      actionName: "saveWidgetAction",
      handler: () => Promise.reject(failure),
    });

    await expect(action(undefined)).resolves.toEqual(
      err("SERVER", "An unexpected error occurred.")
    );
    expect(mocks.serverActionError).toHaveBeenCalledWith(
      failure,
      "SERVER",
      "An unexpected error occurred.",
      { action: "saveWidgetAction" }
    );
  });

  it("maps raw FormData into the schema with mapInput", async () => {
    const handler = vi.fn((input: { issueId: string }) =>
      Promise.resolve(ok(input.issueId))
    );
    const action = createProtectedAction({
      schema: z.object({ issueId: z.string().min(1, "Pick an issue") }),
      mapInput: (formData: FormData) => ({ issueId: formData.get("issueId") }),
      handler,
    });
    const filled = new FormData();
    filled.set("issueId", "issue-1");

    await expect(action(filled)).resolves.toEqual(ok("issue-1"));
    await expect(action(new FormData())).resolves.toEqual(
      err("VALIDATION", "Invalid input: expected string, received null")
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("hands the loaded resource to the permission callback and the handler", async () => {
    const machine = { initials: "AFM", ownerId: "owner-99" };
    const load = vi.fn((input: { initials: string }) =>
      Promise.resolve(ok({ ...machine, initials: input.initials }))
    );
    const action = createProtectedAction({
      schema: z.object({ initials: z.string() }),
      load,
      permission: (_input, { user, resource }) => ({
        permission: "machines.edit",
        ownershipContext: { userId: user.id, machineOwnerId: resource.ownerId },
      }),
      handler: (_input, { resource }) => Promise.resolve(ok(resource.initials)),
    });

    await expect(action({ initials: "AFM" })).resolves.toEqual(ok("AFM"));
    expect(load).toHaveBeenCalledWith(
      { initials: "AFM" },
      { user: USER, accessLevel: "member" }
    );
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      "machines.edit",
      "member",
      { userId: "user-1", machineOwnerId: "owner-99" }
    );
  });

  it("returns the load error before checking permission or running the handler", async () => {
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({
      schema: z.string(),
      load: () => Promise.resolve(err("NOT_FOUND", "Issue not found")),
      permission: "issues.update.reporting",
      handler,
    });

    await expect(action("issue-1")).resolves.toEqual(
      err("NOT_FOUND", "Issue not found")
    );
    expect(mocks.checkPermission).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("uses the action's own FORBIDDEN and SERVER messages", async () => {
    mocks.checkPermission.mockReturnValueOnce(false);
    const failure = new Error("database detail");
    const action = createProtectedAction({
      actionName: "updateIssueStatus",
      permission: "issues.update.reporting",
      forbiddenMessage: "You do not have permission to update this issue",
      serverErrorMessage: "Failed to update status",
      handler: () => Promise.reject(failure),
    });

    await expect(action(undefined)).resolves.toEqual(
      err("FORBIDDEN", "You do not have permission to update this issue")
    );
    await expect(action(undefined)).resolves.toEqual(
      err("SERVER", "Failed to update status")
    );
    expect(mocks.serverActionError).toHaveBeenCalledWith(
      failure,
      "SERVER",
      "Failed to update status",
      { action: "updateIssueStatus" }
    );
  });

  it("infers the input and complete result types", () => {
    const action = createProtectedAction({
      schema: z.object({ value: z.string() }),
      handler: (
        input,
        context
      ): Promise<Result<{ length: number }, "HANDLER_ERROR">> => {
        expectTypeOf(context.user).toEqualTypeOf<User>();
        return Promise.resolve(
          input.value
            ? ok({ length: input.value.length })
            : err("HANDLER_ERROR", "Empty")
        );
      },
    });

    expectTypeOf(action).parameter(0).toEqualTypeOf<{ value: string }>();
    expectTypeOf(action).returns.toEqualTypeOf<
      Promise<
        Result<
          { length: number },
          | "HANDLER_ERROR"
          | "UNAUTHORIZED"
          | "VALIDATION"
          | "FORBIDDEN"
          | "SERVER"
        >
      >
    >();
  });

  it("types the raw argument from mapInput and adds load errors to the result", () => {
    const action = createProtectedAction({
      schema: z.object({ issueId: z.string() }),
      mapInput: (formData: FormData) => ({ issueId: formData.get("issueId") }),
      load: ({ issueId }) =>
        Promise.resolve(
          issueId ? ok({ issueNumber: 7 }) : err("NOT_FOUND", "Issue not found")
        ),
      handler: (_input, { resource }) => {
        expectTypeOf(resource).toEqualTypeOf<{ issueNumber: number }>();
        return Promise.resolve(ok(resource.issueNumber));
      },
    });

    expectTypeOf(action).parameter(0).toEqualTypeOf<FormData>();
    expectTypeOf(action).returns.toEqualTypeOf<
      Promise<
        Result<
          number,
          "NOT_FOUND" | "UNAUTHORIZED" | "VALIDATION" | "FORBIDDEN" | "SERVER"
        >
      >
    >();
  });
});

describe("createPublicAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkPermission.mockReturnValue(true);
  });

  it("runs for a signed-out caller as unauthenticated without a profile lookup", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn((input: string, context: PublicActionContext) =>
      Promise.resolve(ok({ input, userId: context.user?.id ?? null }))
    );
    const action = createPublicAction({
      schema: z.string(),
      permission: "issues.report",
      handler,
    });

    await expect(action("AFM")).resolves.toEqual(
      ok({ input: "AFM", userId: null })
    );
    expect(mocks.getUserAccessLevel).not.toHaveBeenCalled();
    expect(mocks.checkPermission).toHaveBeenCalledWith(
      "issues.report",
      "unauthenticated",
      undefined
    );
  });

  it("resolves a signed-in caller's access level", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: USER } });
    mocks.getUserAccessLevel.mockResolvedValue("member");
    const action = createPublicAction({
      handler: (_input: undefined, { user, accessLevel }) =>
        Promise.resolve(ok({ userId: user?.id, accessLevel })),
    });

    await expect(action(undefined)).resolves.toEqual(
      ok({ userId: "user-1", accessLevel: "member" })
    );
    expect(mocks.getUserAccessLevel).toHaveBeenCalledWith("user-1");
  });

  it("never returns UNAUTHORIZED in its result type", () => {
    const action = createPublicAction({
      handler: (_input: undefined) => Promise.resolve(ok(true)),
    });

    expectTypeOf(action).returns.toEqualTypeOf<
      Promise<Result<boolean, "VALIDATION" | "FORBIDDEN" | "SERVER">>
    >();
  });
});
