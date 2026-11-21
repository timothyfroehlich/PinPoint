import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MachinesPageActions } from "./MachinesPageActions";

async function openActions(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  return screen.findByRole("menu");
}

/** Machine-views §6.6–§6.8 and apron-cards §13.4. */
describe("MachinesPageActions", () => {
  it("shows Pinball Map, then Add Machine, then ⋯", () => {
    render(
      <MachinesPageActions
        canViewLineup
        canCreateMachine
        canPrintApronCards={false}
        apronQueueCount={0}
      />
    );
    const names = [
      ...screen.getAllByRole("link"),
      ...screen.getAllByRole("button"),
    ].map((element) => element.getAttribute("aria-label"));
    expect(names).toEqual(["Pinball Map", "Add Machine", "More"]);
    expect(screen.getByRole("link", { name: "Add Machine" })).toHaveClass(
      "bg-primary"
    );
  });

  it("holds the print entries in ⋯, the queue count on Print apron cards only", async () => {
    render(
      <MachinesPageActions
        canViewLineup={false}
        canCreateMachine={false}
        canPrintApronCards
        apronQueueCount={3}
      />
    );
    expect(screen.queryByText("3")).not.toBeInTheDocument();

    const menu = await openActions();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.getAttribute("aria-label") ?? item.textContent)
    ).toEqual([
      "Print settings sheets",
      "Print apron cards, 3 in your print queue",
    ]);
    expect(
      within(menu).getByRole("menuitem", {
        name: "Print apron cards, 3 in your print queue",
      })
    ).toHaveAttribute("href", "/m/apron-cards");
  });

  it("offers everyone Print settings sheets, and apron cards only to those who can print them", async () => {
    render(
      <MachinesPageActions
        canViewLineup={false}
        canCreateMachine={false}
        canPrintApronCards={false}
        apronQueueCount={0}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const menu = await openActions();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Print settings sheets"]);
  });
});
