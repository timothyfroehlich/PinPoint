import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Download, MapPin, Plus, Printer, Share2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_ACTIONS_MENU_LABEL,
  PageActions,
  type PageAction,
  type PageMenuEntry,
} from "./PageActions";

/**
 * jsdom lays nothing out, so the actions' row and their measured faces get
 * widths here: each labeled face is 100px, each icon 36px, and the row is
 * whatever the test gives it. With an 8px gap and the 16px tolerance, three
 * labeled buttons need 332px and three icons 140px.
 */
function stubLayout(rowWidth: number): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const measure = this.getAttribute("data-measure");
      const width =
        measure !== null
          ? measure.endsWith(":labeled")
            ? 100
            : 36
          : this.hasAttribute("data-page-actions")
            ? rowWidth
            : 0;
      return DOMRect.fromRect({ width, height: 36 });
    }
  );
}

function mockPhone(isPhone: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: isPhone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

const pinballMap: PageAction = {
  key: "pinball-map",
  label: "Pinball Map",
  icon: MapPin,
  href: "/m/pinball-map",
};
const addMachine: PageAction = {
  key: "add-machine",
  label: "Add Machine",
  icon: Plus,
  href: "/m/new",
  primary: true,
};
const print: PageAction = {
  key: "print",
  label: "Print",
  icon: Printer,
  entries: [{ key: "sheets", label: "Settings sheets", href: "/sheets" }],
  foldedEntries: [
    { key: "sheets", label: "Print settings sheets", href: "/sheets" },
  ],
};
const exportEntry: PageMenuEntry = {
  key: "export",
  label: "Export to CSV",
  onSelect: vi.fn(),
};

function renderMachines(): void {
  render(
    <PageActions
      actions={[pinballMap, addMachine]}
      menu={[[exportEntry]]}
      foldSteps={[["pinball-map"], ["add-machine"]]}
    />
  );
}

async function openMenu(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  return screen.findByRole("menu");
}

function menuLabels(menu: HTMLElement): (string | null)[] {
  return within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);
}

describe("PageActions (list-views §3.7–§3.10, §8.11, §8.12)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows every action with its label, and ⋯ reads More, while they fit", () => {
    mockPhone(false);
    stubLayout(400);
    renderMachines();
    expect(screen.getByRole("link", { name: "Pinball Map" })).toHaveTextContent(
      "Pinball Map"
    );
    expect(screen.getByRole("link", { name: "Add Machine" })).toHaveTextContent(
      "Add Machine"
    );
    expect(screen.getByRole("button", { name: "More" })).toHaveTextContent(
      "More"
    );
    expect(PAGE_ACTIONS_MENU_LABEL).toBe("More");
  });

  it("outlines a labeled button and keeps the create action filled (design-bible §26.2)", () => {
    mockPhone(false);
    stubLayout(400);
    renderMachines();
    const map = screen.getByRole("link", { name: "Pinball Map" });
    expect(map).toHaveClass("border-outline", "bg-card");
    expect(map).not.toHaveAttribute("title");
    expect(screen.getByRole("link", { name: "Add Machine" })).toHaveClass(
      "bg-primary"
    );
    expect(screen.getByRole("button", { name: "More" })).toHaveClass(
      "border-outline"
    );
  });

  it("turns every action into an icon button that keeps its name", () => {
    mockPhone(false);
    stubLayout(200);
    renderMachines();
    const map = screen.getByRole("link", { name: "Pinball Map" });
    expect(map).toHaveTextContent("");
    expect(map).not.toHaveAttribute("title");
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveTextContent("");
    // Icon buttons are borderless; the create action stays filled.
    for (const button of [map, more]) {
      expect(button).toHaveClass("border-transparent", "bg-transparent");
      expect(button).not.toHaveClass("border-outline");
    }
    expect(screen.getByRole("link", { name: "Add Machine" })).toHaveClass(
      "bg-primary"
    );
  });

  it("gives an icon button a tooltip that reads its name (design-bible §26.2)", async () => {
    mockPhone(false);
    stubLayout(200);
    renderMachines();
    await userEvent.hover(screen.getByRole("link", { name: "Pinball Map" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Pinball Map");
  });

  it("gives ⋯ as an icon a More tooltip, and still opens its menu", async () => {
    mockPhone(false);
    stubLayout(200);
    renderMachines();
    const more = screen.getByRole("button", { name: "More" });
    await userEvent.hover(more);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("More");
    await userEvent.click(more);
    const menu = await screen.findByRole("menu");
    expect(menuLabels(menu)).toEqual(["Export to CSV"]);
    expect(more).toHaveAttribute("data-state", "open");
  });

  it("shows no tooltip for a labeled button", async () => {
    mockPhone(false);
    stubLayout(400);
    renderMachines();
    await userEvent.hover(screen.getByRole("link", { name: "Pinball Map" }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("folds Pinball Map into ⋯ first, ahead of ⋯'s own entries", async () => {
    mockPhone(false);
    // Two icons need 96px with the tolerance, three need 140px.
    stubLayout(120);
    renderMachines();
    expect(
      screen.queryByRole("link", { name: "Pinball Map" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Add Machine" })
    ).toBeInTheDocument();

    const menu = await openMenu();
    expect(menuLabels(menu)).toEqual(["Pinball Map", "Export to CSV"]);
  });

  it("folds Add Machine last, leaving a lone ⋯", async () => {
    mockPhone(false);
    // Even two icons need 96px with the tolerance.
    stubLayout(60);
    renderMachines();
    expect(
      screen.queryByRole("link", { name: "Add Machine" })
    ).not.toBeInTheDocument();

    const menu = await openMenu();
    expect(menuLabels(menu)).toEqual([
      "Pinball Map",
      "Add Machine",
      "Export to CSV",
    ]);
  });

  it("brings a folded menu's entries into ⋯ (list-views §3.9)", async () => {
    mockPhone(false);
    stubLayout(40);
    render(<PageActions actions={[print]} menu={[]} foldSteps={[["print"]]} />);
    const menu = await openMenu();
    expect(menuLabels(menu)).toEqual(["Print settings sheets"]);
  });

  it("shows no ⋯ while it holds nothing", () => {
    mockPhone(false);
    stubLayout(400);
    render(
      <PageActions actions={[print]} menu={[[]]} foldSteps={[["print"]]} />
    );
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "More" })
    ).not.toBeInTheDocument();
  });

  it("keeps a destructive section last", async () => {
    mockPhone(false);
    stubLayout(400);
    render(
      <PageActions
        actions={[]}
        menu={[
          [
            {
              key: "delete",
              label: "Delete tag…",
              destructive: true,
              onSelect: vi.fn(),
            },
          ],
          [{ key: "rename", label: "Rename…", onSelect: vi.fn() }],
          [exportEntry],
        ]}
        foldSteps={[]}
      />
    );
    const menu = await openMenu();
    expect(menuLabels(menu)).toEqual([
      "Rename…",
      "Export to CSV",
      "Delete tag…",
    ]);
  });

  it("runs an entry's action from the menu", async () => {
    mockPhone(false);
    stubLayout(400);
    const onSelect = vi.fn();
    render(
      <PageActions
        actions={[]}
        menu={[[{ key: "export", label: "Export to CSV", onSelect }]]}
        foldSteps={[]}
      />
    );
    const menu = await openMenu();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Export to CSV" })
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  describe("a lone entry (list-views §3.7)", () => {
    const exportWithIcon: PageMenuEntry = {
      key: "export",
      label: "Export to CSV",
      icon: Download,
      buttonLabel: "Export",
      onSelect: vi.fn(),
    };
    const printEntry: PageMenuEntry = {
      key: "settings-sheets",
      label: "Print settings sheets",
      icon: Printer,
      href: "/sheets",
    };
    const share: PageAction = {
      key: "share",
      label: "Share",
      icon: Share2,
      onSelect: vi.fn(),
    };

    it("shows ⋯'s only entry as its own button, with its button label", async () => {
      mockPhone(false);
      stubLayout(400);
      const onSelect = vi.fn();
      render(
        <PageActions
          actions={[]}
          menu={[[{ ...exportWithIcon, onSelect }]]}
          foldSteps={[]}
        />
      );
      const button = screen.getByRole("button", { name: "Export" });
      expect(button).toHaveTextContent("Export");
      expect(
        screen.queryByRole("button", { name: "More" })
      ).not.toBeInTheDocument();
      await userEvent.click(button);
      expect(onSelect).toHaveBeenCalledWith(button);
    });

    it("folds it after the page's own fold steps, last", () => {
      mockPhone(false);
      // Share and Print as icons need 80px, with the tolerance 96px.
      stubLayout(100);
      render(
        <PageActions
          actions={[share]}
          menu={[[printEntry]]}
          foldSteps={[["share"]]}
        />
      );
      expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Print settings sheets" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "More" })
      ).not.toBeInTheDocument();
    });

    it("goes into ⋯ as itself only when space forces it", async () => {
      mockPhone(false);
      stubLayout(60);
      render(
        <PageActions
          actions={[share]}
          menu={[[printEntry]]}
          foldSteps={[["share"]]}
        />
      );
      expect(
        screen.queryByRole("link", { name: "Print settings sheets" })
      ).not.toBeInTheDocument();
      const menu = await openMenu();
      expect(menuLabels(menu)).toEqual(["Share", "Print settings sheets"]);
      // Folded actions and ⋯'s own entries sit in separate sections.
      expect(within(menu).getAllByRole("separator")).toHaveLength(1);
    });

    it("reads its menu label in ⋯ once it folds", async () => {
      mockPhone(false);
      stubLayout(40);
      render(
        <PageActions actions={[]} menu={[[exportWithIcon]]} foldSteps={[]} />
      );
      expect(
        screen.queryByRole("button", { name: "Export" })
      ).not.toBeInTheDocument();
      const menu = await openMenu();
      expect(menuLabels(menu)).toEqual(["Export to CSV"]);
    });

    it("stays in ⋯ when it has no icon", async () => {
      mockPhone(false);
      stubLayout(400);
      render(
        <PageActions
          actions={[]}
          menu={[[{ ...printEntry, icon: undefined }]]}
          foldSteps={[]}
        />
      );
      const menu = await openMenu();
      expect(menuLabels(menu)).toEqual(["Print settings sheets"]);
    });

    it("stays in ⋯ beside another entry", async () => {
      mockPhone(false);
      stubLayout(400);
      render(
        <PageActions
          actions={[share]}
          menu={[[exportWithIcon, printEntry]]}
          foldSteps={[["share"]]}
        />
      );
      const menu = await openMenu();
      expect(menuLabels(menu)).toEqual([
        "Export to CSV",
        "Print settings sheets",
      ]);
    });
  });

  it("opens ⋯ as a sheet on phones (list-views §3.10)", async () => {
    mockPhone(true);
    stubLayout(400);
    const onSelect = vi.fn();
    render(
      <PageActions
        actions={[pinballMap]}
        menu={[[{ key: "export", label: "Export to CSV", onSelect }]]}
        foldSteps={[["pinball-map"]]}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog", { name: "More" });
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Export to CSV" })
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
