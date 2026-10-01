/**
 * The Manage tab's section list (machine-editing 5.1–5.2). The observer
 * geometry is the browser's; these pin the wiring the page relies on — one
 * link per section in order, jumping by fragment, and the in-view mark.
 */
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionNavLayout } from "./SectionNav";
import { SectionAnchor } from "./SectionAnchor";

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

/** Every observer the component made, with what it observes. */
const observers: { callback: ObserverCallback; targets: Element[] }[] = [];

class FakeIntersectionObserver {
  private readonly record: { callback: ObserverCallback; targets: Element[] };
  constructor(callback: ObserverCallback) {
    this.record = { callback, targets: [] };
    observers.push(this.record);
  }
  observe(target: Element): void {
    this.record.targets.push(target);
  }
  disconnect(): void {
    this.record.targets = [];
  }
}

const EMPTY_RECT: DOMRectReadOnly = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
};

function entry(
  target: Element,
  isIntersecting: boolean
): IntersectionObserverEntry {
  // The component reads only `target` and `isIntersecting`.
  return {
    target,
    isIntersecting,
    boundingClientRect: EMPTY_RECT,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: EMPTY_RECT,
    rootBounds: null,
    time: 0,
  };
}

const SECTIONS = [
  { id: "s-details", label: "Details" },
  { id: "s-model", label: "Model Details" },
  { id: "s-danger", label: "Danger zone" },
];

function renderNav(): void {
  render(
    <SectionNavLayout sections={SECTIONS}>
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <SectionAnchor id={section.id} />
          <h2>{section.label}</h2>
        </div>
      ))}
    </SectionNavLayout>
  );
}

describe("SectionNavLayout", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("links every section, in order, by fragment", () => {
    renderNav();

    const nav = screen.getByTestId("section-nav");
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Details",
      "Model Details",
      "Danger zone",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#s-details",
      "#s-model",
      "#s-danger",
    ]);
  });

  it("marks the last section whose start has passed the reading line", () => {
    renderNav();
    const [line] = observers;
    if (line === undefined) throw new Error("no observer created");
    const anchor = (id: string): Element => {
      const el = document.getElementById(id);
      if (el === null) throw new Error(`missing anchor ${id}`);
      return el;
    };

    act(() => {
      line.callback([
        entry(anchor("s-details"), true),
        entry(anchor("s-model"), true),
        entry(anchor("s-danger"), false),
      ]);
    });

    const nav = screen.getByTestId("section-nav");
    expect(nav.querySelector('[aria-current="location"]')?.textContent).toBe(
      "Model Details"
    );
    expect(screen.getByTestId("section-jump")).toHaveTextContent(
      "Jump toModel Details"
    );
  });

  it("opens the section list from the phone control", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByTestId("section-jump"));

    expect(
      await screen.findByRole("menuitem", { name: "Danger zone" })
    ).toHaveAttribute("href", "#s-danger");
  });
});
