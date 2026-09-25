import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { updateDefaultReportModeAction } from "./actions";

const mockGetUser = vi.fn();
const mockGetUserAccessLevel = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser } })
  ),
}));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: (...args: unknown[]) => mockGetUserAccessLevel(...args),
}));
vi.mock("~/server/db", () => ({
  db: { update: (...args: unknown[]) => mockUpdate(...args) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function reportModes(mobile: string, desktop: string): FormData {
  const formData = new FormData();
  formData.set("mobileReportMode", mobile);
  formData.set("desktopReportMode", desktop);
  return formData;
}

describe("updateDefaultReportModeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "reporter-1" } } });
    mockGetUserAccessLevel.mockResolvedValue("member");
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([
      { mobileMode: "quick", desktopMode: "detailed" },
    ]);
  });

  it("saves both settings for an authorized reporter", async () => {
    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("quick", "detailed")
    );

    expect(result).toEqual({
      ok: true,
      value: { mobileMode: "quick", desktopMode: "detailed" },
    });
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        mobileReportMode: "quick",
        desktopReportMode: "detailed",
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid values before updating", async () => {
    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("unknown", "detailed")
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects Multiple when batch access is absent", async () => {
    mockGetUserAccessLevel.mockResolvedValue("guest");
    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("multiple", "detailed")
    );
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await updateDefaultReportModeAction(
      undefined,
      reportModes("quick", "detailed")
    );
    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
