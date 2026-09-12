import * as React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, findProfileMock, redirectMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  findProfileMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

vi.mock("~/server/db", () => ({
  db: { query: { userProfiles: { findFirst: findProfileMock } } },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import AdminIntegrationsLayout from "./layout";

describe("AdminIntegrationsLayout", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    findProfileMock.mockReset();
    redirectMock.mockClear();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-id" } } });
    findProfileMock.mockResolvedValue({ role: "admin" });
  });

  it("renders for the manage-integrations capability", async () => {
    render(
      await AdminIntegrationsLayout({
        children: <p>Integration settings</p>,
      })
    );

    expect(screen.getByText("Integration settings")).toBeInTheDocument();
  });

  it("renders Forbidden for a member", async () => {
    findProfileMock.mockResolvedValue({ role: "member" });

    render(
      await AdminIntegrationsLayout({
        children: <p>Integration settings</p>,
      })
    );

    expect(
      screen.getByRole("heading", { name: "Access Denied" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Integration settings")).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated request back to the combined route", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await expect(
      AdminIntegrationsLayout({ children: <p>Integration settings</p> })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/login?next=%2Fadmin%2Fintegrations"
    );
  });
});
