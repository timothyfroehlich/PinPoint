import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateDefaultReportModeAction } from "./actions";
import { DefaultReportModeForm } from "./default-report-mode-form";

vi.mock("./actions", () => ({
  updateDefaultReportModeAction: vi.fn(),
}));

describe("DefaultReportModeForm", () => {
  beforeEach(() => {
    vi.mocked(updateDefaultReportModeAction).mockReset();
  });

  it("shows separate mobile and header choices with their defaults", () => {
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const mobile = screen.getByRole("group", { name: "Mobile bottom bar" });
    const header = screen.getByRole("group", {
      name: "Tablet and desktop header",
    });
    expect(
      within(mobile).getByRole("radio", { name: /Quick report/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(header).getByRole("radio", { name: /Detailed report/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radio", { name: /Multiple issues/ })).toBeNull();
  });

  it("offers Multiple in both settings only with batch access", () => {
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple
      />
    );
    expect(
      screen.getAllByRole("radio", { name: /Multiple issues/ })
    ).toHaveLength(2);
  });

  it("lets the two choices change independently", async () => {
    const user = userEvent.setup();
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const mobile = screen.getByRole("group", { name: "Mobile bottom bar" });
    const header = screen.getByRole("group", {
      name: "Tablet and desktop header",
    });
    const detailedOnMobile = within(mobile).getByRole("radio", {
      name: /Detailed report/,
    });
    await user.click(detailedOnMobile);

    expect(detailedOnMobile).toHaveAttribute("aria-checked", "true");
    expect(
      within(header).getByRole("radio", { name: /Detailed report/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", { name: "Save report screens" })
    ).toBeEnabled();
  });

  it("keeps the saved choices selected after submitting", async () => {
    vi.mocked(updateDefaultReportModeAction).mockResolvedValue({
      ok: true,
      value: { mobileMode: "detailed", desktopMode: "quick" },
    });
    const user = userEvent.setup();
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const mobile = screen.getByRole("group", { name: "Mobile bottom bar" });
    const header = screen.getByRole("group", {
      name: "Tablet and desktop header",
    });
    const mobileDetailed = within(mobile).getByRole("radio", {
      name: /Detailed report/,
    });
    const headerQuick = within(header).getByRole("radio", {
      name: /Quick report/,
    });

    await user.click(mobileDetailed);
    await user.click(headerQuick);
    await user.click(
      screen.getByRole("button", { name: "Save report screens" })
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Report screens saved."
      );
    });
    expect(mobileDetailed).toHaveAttribute("aria-checked", "true");
    expect(headerQuick).toHaveAttribute("aria-checked", "true");
    expect(updateDefaultReportModeAction).toHaveBeenCalledTimes(1);
  });

  it("supports arrow keys within each report-screen group", async () => {
    const user = userEvent.setup();
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const mobile = screen.getByRole("group", { name: "Mobile bottom bar" });
    const quick = within(mobile).getByRole("radio", { name: /Quick report/ });
    const detailed = within(mobile).getByRole("radio", {
      name: /Detailed report/,
    });
    quick.focus();
    await user.keyboard("{ArrowRight}");
    expect(detailed).toHaveFocus();
    expect(detailed).toHaveAttribute("aria-checked", "true");
    expect(quick).toHaveAttribute("aria-checked", "false");
  });
});
