import { describe, it, expect, vi, beforeEach } from "vitest";

const getPublicMachineByIdMock = vi.fn();
const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), {
  digest: "NEXT_NOT_FOUND",
});

vi.mock("~/lib/dal/public-machines", () => ({
  getPublicMachineById: getPublicMachineByIdMock,
}));

vi.mock("next/navigation", () => ({
  notFound: (): never => {
    throw notFoundError;
  },
}));

describe("ReportMachinePage", () => {
  beforeEach(() => {
    vi.resetModules();
    getPublicMachineByIdMock.mockReset();
  });

  it("bubbles Next.js notFound errors when machine is missing", async () => {
    getPublicMachineByIdMock.mockResolvedValue(null);
    const { default: ReportMachinePage } = await import("./page");

    await expect(
      ReportMachinePage({
        params: Promise.resolve({ machineId: "missing-machine" }),
      }),
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });
  });
});
