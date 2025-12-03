import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateNotificationPreferencesAction } from "./actions";
import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";

// Mock dependencies
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

describe("updateNotificationPreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should revalidate /settings path on success", async () => {
    // Mock authenticated user
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-id" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Create valid form data
    const formData = new FormData();
    formData.append("emailEnabled", "on");
    formData.append("inAppEnabled", "on");
    // Add other required fields if necessary, or rely on schema allowing optional/defaults?
    // The schema has boolean fields. FormData.get() returns null if missing, which !== "on", so false.
    // The schema expects booleans.
    // Let's check the schema in actions.ts.
    // It uses z.boolean().
    // In the action: emailEnabled: formData.get("emailEnabled") === "on"
    // So missing fields become false. This is valid.

    const result = await updateNotificationPreferencesAction(
      undefined,
      formData
    );

    expect(result.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
  });
});
