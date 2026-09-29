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

  it("lists the Pinball Map lineup right after Integrations", async () => {
    const user = userEvent.setup();
    render(<UserMenu userName="Ada Admin" role="admin" />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    const lineup = screen.getByTestId("user-menu-admin-pinball-map");
    expect(lineup).toHaveAttribute("href", "/m/pinball-map");
    expect(lineup).toHaveTextContent("Pinball Map lineup");
    const items = screen.getAllByRole("menuitem");
    const integrations = items.indexOf(
      screen.getByTestId("user-menu-admin-integrations")
    );
    expect(items[integrations + 1]).toBe(lineup);
  });

  it("does not show the admin group to members", async () => {
    const user = userEvent.setup();
    render(<UserMenu userName="Mo Member" role="member" />);

    await user.click(screen.getByRole("button", { name: "User menu" }));

    expect(
      screen.queryByTestId("user-menu-admin-pinball-map")
    ).not.toBeInTheDocument();
  });
});
