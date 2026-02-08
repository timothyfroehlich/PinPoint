import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Forbidden } from "./Forbidden";

describe("Forbidden", () => {
  it("renders 403 error with default message", () => {
    render(<Forbidden />);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to access this page.")
    ).toBeInTheDocument();
  });

  it("renders custom message when provided", () => {
    render(<Forbidden message="You need admin access" />);

    expect(screen.getByText("You need admin access")).toBeInTheDocument();
  });

  it("displays user role when provided", () => {
    render(<Forbidden role="guest" />);

    expect(screen.getByText("Your current role:")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
  });

  it("capitalizes role label correctly", () => {
    render(<Forbidden role="member" />);

    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("does not show role section when role is null", () => {
    render(<Forbidden role={null} />);

    expect(screen.queryByText("Your current role:")).not.toBeInTheDocument();
  });

  it("renders Go Back link with default URL", () => {
    render(<Forbidden />);

    const backLink = screen.getByRole("link", { name: /go back/i });
    expect(backLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders Go Back link with custom URL", () => {
    render(<Forbidden backUrl="/m" />);

    const backLink = screen.getByRole("link", { name: /go back/i });
    expect(backLink).toHaveAttribute("href", "/m");
  });

  it("renders Home link", () => {
    render(<Forbidden />);

    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
