import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AccountEmail } from "./account-email";

describe("AccountEmail", () => {
  it("shows the email read-only for a normal account (CORE-SEC-007: own settings)", () => {
    render(<AccountEmail email="member@test.com" />);
    expect(screen.getByTestId("account-email")).toHaveTextContent(
      "member@test.com"
    );
    expect(screen.queryByTestId("account-email-none")).toBeNull();
  });

  it("hides the synthetic address for internal username accounts", () => {
    render(<AccountEmail email="testuser@pinpoint.internal" />);
    expect(screen.getByTestId("account-email-none")).toBeInTheDocument();
    expect(screen.queryByTestId("account-email")).toBeNull();
    // The synthetic @pinpoint.internal address must never be rendered.
    expect(screen.queryByText(/pinpoint\.internal/)).toBeNull();
  });
});
