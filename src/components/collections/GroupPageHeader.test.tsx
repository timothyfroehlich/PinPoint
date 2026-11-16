import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COLLECTIONS_CRUMB,
  tagCrumbs,
} from "~/components/collections/GroupBreadcrumb";
import { GroupPageHeader } from "./GroupPageHeader";

/**
 * jsdom lays nothing out, so the header and its one-line measurements get
 * widths here: the title is 300px, the breadcrumb 92px, and the header
 * whatever the test gives it. Inline, they need 92 + 8 + 300 = 400px plus
 * the 16px tolerance; a description column adds 24 + 280 = 304px.
 */
function stubLayout(headerWidth: number): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const measure = this.getAttribute("data-measure");
      const width =
        measure === "title"
          ? 300
          : measure === "breadcrumb"
            ? 92
            : this.getAttribute("data-testid") === "group-header"
              ? headerWidth
              : 0;
      return DOMRect.fromRect({ width, height: 30 });
    }
  );
}

function header(): HTMLElement {
  return screen.getByTestId("group-header");
}

describe("GroupPageHeader (collections-and-tags 4.8–4.11)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the title with no counts and the breadcrumb's links", () => {
    stubLayout(1200);
    render(
      <GroupPageHeader
        title="Electromechanicals"
        breadcrumb={tagCrumbs({ label: "Era", href: "/c/tags/era" })}
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Electromechanicals" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute(
      "href",
      "/c/tags"
    );
    expect(screen.getByRole("link", { name: "Era" })).toHaveAttribute(
      "href",
      "/c/tags/era"
    );
    expect(screen.queryByTestId("collection-summary")).not.toBeInTheDocument();
  });

  it("keeps the breadcrumb inline and the description beside on a wide header", () => {
    stubLayout(400 + 304 + 16);
    render(
      <GroupPageHeader
        title="Restoration queue"
        breadcrumb={[COLLECTIONS_CRUMB]}
        description={<p>Games waiting on parts.</p>}
      />
    );

    expect(header()).toHaveAttribute("data-breadcrumb-wide", "inline");
    expect(header()).toHaveAttribute("data-description", "beside");
    // Phones never count the description, so the breadcrumb stays inline.
    expect(header()).toHaveAttribute("data-breadcrumb-phone", "inline");
  });

  it("moves the breadcrumb above the title before the description moves", () => {
    stubLayout(300 + 304 + 16);
    render(
      <GroupPageHeader
        title="Restoration queue"
        breadcrumb={[COLLECTIONS_CRUMB]}
        description={<p>Games waiting on parts.</p>}
      />
    );

    expect(header()).toHaveAttribute("data-breadcrumb-wide", "above");
    expect(header()).toHaveAttribute("data-description", "beside");
    expect(header()).toHaveAttribute("data-breadcrumb-phone", "inline");
  });

  it("puts the breadcrumb above and the description under on a narrow header", () => {
    stubLayout(380);
    render(
      <GroupPageHeader
        title="Restoration queue"
        breadcrumb={[COLLECTIONS_CRUMB]}
        description={<p>Games waiting on parts.</p>}
      />
    );

    expect(header()).toHaveAttribute("data-breadcrumb-wide", "above");
    expect(header()).toHaveAttribute("data-breadcrumb-phone", "above");
    expect(header()).toHaveAttribute("data-description", "under");
  });

  it("shows no breadcrumb when the page has none", () => {
    stubLayout(1200);
    render(<GroupPageHeader title="Shared queue" breadcrumb={[]} />);

    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" })
    ).not.toBeInTheDocument();
    expect(header()).toHaveAttribute("data-breadcrumb-wide", "above");
  });
});
