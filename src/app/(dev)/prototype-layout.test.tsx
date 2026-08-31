import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import PrototypeLayout, { metadata } from "./prototype/layout";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("PrototypeLayout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("renders disposable prototype content outside production", () => {
    vi.stubEnv("VERCEL_ENV", "development");

    render(PrototypeLayout({ children: <p>prototype</p> }));

    expect(screen.getByText("prototype")).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("returns not found in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => PrototypeLayout({ children: "prototype" })).toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFoundMock).toHaveBeenCalledOnce();
  });

  it("marks every prototype as noindex and nofollow", () => {
    expect(metadata).toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });
  });
});
