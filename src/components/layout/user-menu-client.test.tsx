import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu-client";

vi.mock("~/app/(auth)/actions", () => ({ logoutAction: vi.fn() }));

describe("UserMenu admin navigation", () => {
  it("links desktop administrators to the combined integrations page", async () => {
    const user = userEvent.setup();
    render(<UserMenu userName="Ada Admin" role="admin" />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(screen.getByTestId("user-menu-admin-integrations")).toHaveAttribute(
      "href",
      "/admin/integrations"
    );
  });
});
