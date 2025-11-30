import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitPublicIssueAction } from "~/app/report/actions";
import { redirect } from "next/navigation";
import { db } from "~/server/db";
import { checkPublicIssueLimit, getClientIp } from "~/lib/rate-limit";

// Mock dependencies
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn(),
  getClientIp: vi.fn(),
  formatResetTime: vi.fn((t) => `${t}`), // Simple mock
}));

vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
       machines: {
         findMany: vi.fn()
       }
    }
  },
}));

vi.mock("~/server/db/schema", () => ({
  issues: {},
}));

vi.mock("~/lib/timeline/events", () => ({
  createTimelineEvent: vi.fn(),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("submitPublicIssueAction", () => {
  const validMachineId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(getClientIp).mockResolvedValue("127.0.0.1");
    vi.mocked(checkPublicIssueLimit).mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 1000,
    });

    // Mock DB insert
     const mockReturning = vi.fn().mockResolvedValue([{ id: 1 }]);
     const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    // eslint-disable-next-line @typescript-eslint/unbound-method
     vi.mocked(db.insert).mockReturnValue({
       values: mockValues,
     } as unknown as ReturnType<typeof db.insert>);
  });

  it("should fail if honeypot is filled", async () => {
    const formData = new FormData();
    formData.append("website", "bot-filled");

    try {
      await submitPublicIssueAction(formData);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "NEXT_REDIRECT") {
        throw error;
      }
    }

    expect(redirect).toHaveBeenCalledWith("/report/success");
    // Should not check rate limit or database
    expect(checkPublicIssueLimit).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should fail if rate limit is exceeded", async () => {
    vi.mocked(checkPublicIssueLimit).mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 123456789,
    });

    const formData = new FormData();
    formData.append("machineId", validMachineId);
    formData.append("title", "Test");
    formData.append("severity", "minor");

    try {
      await submitPublicIssueAction(formData);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "NEXT_REDIRECT") {
        throw error;
      }
    }

    // Should redirect with error
    const expectedError = "Too many submissions. Please try again in 123456789.";
    const params = new URLSearchParams({ error: expectedError });
    expect(redirect).toHaveBeenCalledWith(`/report?${params.toString()}`);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should succeed if valid and within rate limit", async () => {
    const formData = new FormData();
    formData.append("machineId", validMachineId);
    formData.append("title", "Test");
    formData.append("severity", "minor");

    try {
      await submitPublicIssueAction(formData);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "NEXT_REDIRECT") {
        throw error;
      }
    }

    expect(redirect).toHaveBeenCalledWith("/report/success");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.insert).toHaveBeenCalled();
  });
});
