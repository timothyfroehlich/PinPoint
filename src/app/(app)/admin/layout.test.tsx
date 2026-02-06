import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import AdminLayout from "./layout";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as unknown as Record<string, string>).digest =
      `NEXT_REDIRECT;replace;${url};`;
    throw error;
  }),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock drizzle-orm (needed for eq import)
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// Mock schema
vi.mock("~/server/db/schema", () => ({
  userProfiles: { id: "id" },
}));

const mockCreateClient = vi.mocked(createClient);
const mockFindFirst = vi.mocked(db.query.userProfiles.findFirst);

function mockSupabaseUser(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login for unauthenticated users", async () => {
    mockSupabaseUser(null);

    await expect(
      AdminLayout({ children: <div>Admin Content</div> })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("shows Forbidden for guest users", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockFindFirst.mockResolvedValue({ role: "guest" });

    const result = await AdminLayout({ children: <div>Admin Content</div> });
    render(result);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("shows Forbidden for member users", async () => {
    mockSupabaseUser({ id: "user-2" });
    mockFindFirst.mockResolvedValue({ role: "member" });

    const result = await AdminLayout({ children: <div>Admin Content</div> });
    render(result);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("renders children for admin users", async () => {
    mockSupabaseUser({ id: "admin-1" });
    mockFindFirst.mockResolvedValue({ role: "admin" });

    const result = await AdminLayout({ children: <div>Admin Content</div> });
    render(result);

    expect(screen.getByText("Admin Content")).toBeInTheDocument();
    expect(screen.queryByText("403")).not.toBeInTheDocument();
  });
});
