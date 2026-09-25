import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  updateDefaultReportModeAction,
  type UpdateDefaultReportModeResult,
} from "./actions";
import { DefaultReportModeForm } from "./default-report-mode-form";

vi.mock("./actions", () => ({
  updateDefaultReportModeAction: vi.fn(),
}));

describe("DefaultReportModeForm", () => {
  beforeEach(() => {
    vi.mocked(updateDefaultReportModeAction).mockReset();
  });

  it("shows compact desktop and mobile rows with their defaults", () => {
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Default Report Form" })
    ).toBeInTheDocument();
    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    expect(within(mobile).getByRole("radio", { name: "Quick" })).toBeChecked();
    expect(
      within(desktop).getByRole("radio", { name: "Detailed" })
    ).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Multiple" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("lists the mobile row before the desktop row", () => {
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );
    const groupNames = screen
      .getAllByRole("group")
      .map((group) => group.querySelector("legend")?.textContent);
    expect(groupNames).toEqual([
      "Mobile report form",
      "Desktop / Tablet report form",
    ]);
  });

  it("marks a choice pending until the server confirms it", async () => {
    let completeSave: (result: UpdateDefaultReportModeResult) => void = () => {
      throw new Error("Save did not start");
    };
    vi.mocked(updateDefaultReportModeAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          completeSave = resolve;
        })
    );
    const user = userEvent.setup();
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    await user.click(within(mobile).getByRole("radio", { name: "Detailed" }));
    expect(mobile).toHaveAttribute("aria-busy", "true");
    expect(desktop).toHaveAttribute("aria-busy", "false");

    completeSave({
      ok: true,
      value: { mobileMode: "detailed", desktopMode: "detailed" },
    });
    await waitFor(() => {
      expect(mobile).toHaveAttribute("aria-busy", "false");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("offers Multiple in both settings only with batch access", () => {
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple
      />
    );
    expect(screen.getAllByRole("radio", { name: "Multiple" })).toHaveLength(2);
  });

  it("saves each selection immediately and preserves the other preference", async () => {
    vi.mocked(updateDefaultReportModeAction)
      .mockResolvedValueOnce({
        ok: true,
        value: { mobileMode: "quick", desktopMode: "quick" },
      })
      .mockResolvedValueOnce({
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

    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    await user.click(within(desktop).getByRole("radio", { name: "Quick" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
    const firstForm = vi.mocked(updateDefaultReportModeAction).mock
      .calls[0]?.[1];
    expect(firstForm?.get("mobileReportMode")).toBe("quick");
    expect(firstForm?.get("desktopReportMode")).toBe("quick");

    await user.click(within(mobile).getByRole("radio", { name: "Detailed" }));
    await waitFor(() => {
      expect(updateDefaultReportModeAction).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
    const secondForm = vi.mocked(updateDefaultReportModeAction).mock
      .calls[1]?.[1];
    expect(secondForm?.get("mobileReportMode")).toBe("detailed");
    expect(secondForm?.get("desktopReportMode")).toBe("quick");
    expect(within(desktop).getByRole("radio", { name: "Quick" })).toBeChecked();
    expect(
      within(mobile).getByRole("radio", { name: "Detailed" })
    ).toBeChecked();
  });

  it("queues the latest selection while a save is in flight", async () => {
    let completeFirst: (result: UpdateDefaultReportModeResult) => void = () => {
      throw new Error("First save did not start");
    };
    vi.mocked(updateDefaultReportModeAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            completeFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
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

    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    await user.click(within(desktop).getByRole("radio", { name: "Quick" }));
    await user.click(within(mobile).getByRole("radio", { name: "Detailed" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    expect(updateDefaultReportModeAction).toHaveBeenCalledTimes(1);

    completeFirst({
      ok: true,
      value: { mobileMode: "quick", desktopMode: "quick" },
    });
    await waitFor(() => {
      expect(updateDefaultReportModeAction).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
    expect(
      within(mobile).getByRole("radio", { name: "Detailed" })
    ).toBeChecked();
    expect(within(desktop).getByRole("radio", { name: "Quick" })).toBeChecked();
  });

  it("submits a queued choice when the save ahead of it fails", async () => {
    let failFirst: (result: UpdateDefaultReportModeResult) => void = () => {
      throw new Error("First save did not start");
    };
    vi.mocked(updateDefaultReportModeAction)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            failFirst = resolve;
          })
      )
      .mockResolvedValueOnce({
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

    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    await user.click(within(desktop).getByRole("radio", { name: "Quick" }));
    await user.click(within(mobile).getByRole("radio", { name: "Detailed" }));

    failFirst({
      ok: false,
      code: "SERVER",
      message: "Your profile could not be updated. Try again.",
    });
    await waitFor(() => {
      expect(updateDefaultReportModeAction).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("status")).toHaveTextContent("Saved");
    });
    const retried = vi.mocked(updateDefaultReportModeAction).mock.calls[1]?.[1];
    expect(retried?.get("mobileReportMode")).toBe("detailed");
    expect(retried?.get("desktopReportMode")).toBe("quick");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      within(mobile).getByRole("radio", { name: "Detailed" })
    ).toBeChecked();
    expect(within(desktop).getByRole("radio", { name: "Quick" })).toBeChecked();
  });

  it("restores the confirmed choice and reports a failed save", async () => {
    vi.mocked(updateDefaultReportModeAction).mockResolvedValue({
      ok: false,
      code: "SERVER",
      message: "Your profile could not be updated. Try again.",
    });
    const user = userEvent.setup();
    render(
      <DefaultReportModeForm
        initialMobileMode="quick"
        initialDesktopMode="detailed"
        canMultiple={false}
      />
    );

    const desktop = screen.getByRole("group", {
      name: "Desktop / Tablet report form",
    });
    await user.click(within(desktop).getByRole("radio", { name: "Quick" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not be updated"
      );
    });
    expect(
      within(desktop).getByRole("radio", { name: "Detailed" })
    ).toBeChecked();
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

    vi.mocked(updateDefaultReportModeAction).mockResolvedValue({
      ok: true,
      value: { mobileMode: "detailed", desktopMode: "detailed" },
    });
    const mobile = screen.getByRole("group", { name: "Mobile report form" });
    const quick = within(mobile).getByRole("radio", { name: "Quick" });
    const detailed = within(mobile).getByRole("radio", {
      name: "Detailed",
    });
    quick.focus();
    await user.keyboard("{ArrowRight}");
    expect(detailed).toHaveFocus();
    expect(detailed).toBeChecked();
    expect(quick).not.toBeChecked();
  });
});
