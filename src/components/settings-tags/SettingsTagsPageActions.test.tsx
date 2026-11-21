import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsTagsPageActions } from "./SettingsTagsPageActions";

vi.mock("~/app/(app)/c/settings-tags/actions", () => ({
  createSettingsTagAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

/** The Settings tags page's create action (machine-settings §3.3). */
describe("SettingsTagsPageActions", () => {
  it("is a filled page action that opens New settings tag and takes focus back", async () => {
    const user = userEvent.setup();
    render(<SettingsTagsPageActions />);
    const create = screen.getByRole("button", { name: "New settings tag" });
    expect(create).toHaveClass("bg-primary");

    await user.click(create);
    expect(
      await screen.findByRole("dialog", { name: "New settings tag" })
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(create).toHaveFocus();
  });
});
