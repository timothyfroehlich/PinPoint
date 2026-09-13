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

import { createProtectedAction } from "./pipeline";

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

  it("returns VALIDATION_ERROR without checking permission or running the handler", async () => {
    const handler = vi.fn(() => Promise.resolve(ok("done")));
    const action = createProtectedAction({
      schema: z.object({ count: z.number().int().positive() }),
      permission: "issues.watch",
      handler,
    });

    const result = await action({ count: -1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toContain("count");
    }
    expect(mocks.checkPermission).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
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
          | "VALIDATION_ERROR"
          | "FORBIDDEN"
          | "SERVER"
        >
      >
    >();
  });
});
