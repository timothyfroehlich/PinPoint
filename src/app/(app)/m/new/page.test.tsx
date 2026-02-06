import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import NewMachinePage from "./page";

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

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// Mock schema
vi.mock("~/server/db/schema", () => ({
  userProfiles: { id: "id" },
}));

// Mock the CreateMachineForm (client component)
vi.mock("./create-machine-form", () => ({
  CreateMachineForm: () => <div data-testid="create-machine-form">Form</div>,
}));

// Mock getUnifiedUsers
vi.mock("~/lib/users/queries", () => ({
  getUnifiedUsers: vi.fn().mockResolvedValue([]),
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

describe("NewMachinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login for unauthenticated users", async () => {
    mockSupabaseUser(null);

    await expect(NewMachinePage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fm%2Fnew");
  });

  it("shows Forbidden for guest users", async () => {
    mockSupabaseUser({ id: "user-1" });
    mockFindFirst.mockResolvedValue({ role: "guest" });

    const result = await NewMachinePage();
    render(result);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    // Back link should go to /m
    const backLink = screen.getByRole("link", { name: /go back/i });
    expect(backLink).toHaveAttribute("href", "/m");
  });

  it("shows Forbidden for member users", async () => {
    mockSupabaseUser({ id: "user-2" });
    mockFindFirst.mockResolvedValue({ role: "member" });

    const result = await NewMachinePage();
    render(result);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.queryByText("Add New Machine")).not.toBeInTheDocument();
  });

  it("renders the page for admin users", async () => {
    mockSupabaseUser({ id: "admin-1" });
    mockFindFirst.mockResolvedValue({ role: "admin" });

    const result = await NewMachinePage();
    render(result);

    expect(screen.getByText("Add New Machine")).toBeInTheDocument();
    expect(screen.getByTestId("create-machine-form")).toBeInTheDocument();
    expect(screen.queryByText("403")).not.toBeInTheDocument();
  });
});
