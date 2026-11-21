import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsTagPageActions } from "./SettingsTagPageActions";

vi.mock("~/app/(app)/c/settings-tags/actions", () => ({
  renameSettingsTagAction: vi.fn(),
  deleteSettingsTagAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const PRINT = "/m/settings-sheets?m=AFM&to=league";
const manage = { tagId: "t1", name: "League", setCount: 2, machineCount: 1 };

/** A settings tag page's actions (machine-settings §3.3, §3.6; design-bible §26). */
describe("SettingsTagPageActions", () => {
  it("shows everyone else Print settings sheets as its own button (list-views §3.7)", () => {
    render(<SettingsTagPageActions printHref={PRINT} manage={null} />);
    expect(
      screen.getByRole("link", { name: "Print settings sheets" })
    ).toHaveAttribute("href", PRINT);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("holds Rename, Print settings sheets, and Delete last in ⋯ for managers", async () => {
    render(<SettingsTagPageActions printHref={PRINT} manage={manage} />);
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Rename…", "Print settings sheets", "Delete tag"]);
    expect(
      within(menu).getByRole("menuitem", { name: "Print settings sheets" })
    ).toHaveAttribute("href", PRINT);
    expect(
      within(menu).getByRole("menuitem", { name: "Delete tag" })
    ).toHaveAttribute("data-variant", "destructive");
  });

  it("confirms Delete tag and returns focus to ⋯ when kept", async () => {
    const user = userEvent.setup();
    render(<SettingsTagPageActions printHref={PRINT} manage={manage} />);
    const more = screen.getByRole("button", { name: "More" });
    await user.click(more);
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete tag" })
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: "Delete “League”?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(more).toHaveFocus();
  });
});
