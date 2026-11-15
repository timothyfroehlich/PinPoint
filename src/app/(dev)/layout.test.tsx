import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import DevLayout from "./layout";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("~/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

describe("DevLayout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("renders dev content outside production when VERCEL_ENV is unset", () => {
    render(DevLayout({ children: <p>dev page</p> }));

    expect(screen.getByText("dev page")).toBeInTheDocument();
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("renders dev content outside production when VERCEL_ENV is preview", () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    render(DevLayout({ children: <p>dev page</p> }));

    expect(screen.getByText("dev page")).toBeInTheDocument();
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("returns not found in Vercel production", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => DevLayout({ children: "dev page" })).toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
