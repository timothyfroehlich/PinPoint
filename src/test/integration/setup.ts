import { vi } from "vitest";
import { createClient } from "~/lib/supabase/server";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockUser = { id: "user-123" };

vi.mocked(createClient).mockResolvedValue({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
  },
} as any);
