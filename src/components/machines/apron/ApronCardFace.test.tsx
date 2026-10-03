import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApronCardContent } from "~/lib/machines/apron-card";
import { ApronCardFace } from "./ApronCardFace";

// next/font is a build-time transform; outside Next its loaders are not
// callable. The row copy under test does not depend on the typeface.
vi.mock("./fonts", () => ({
  barlow: { variable: "", style: { fontFamily: "serif" } },
  barlowCondensed: { variable: "", style: { fontFamily: "serif" } },
}));

const content: ApronCardContent = {
  name: "Godzilla",
  edition: null,
  manufacturer: "Stern",
  year: 2021,
  ownerName: "Tim",
  description: [],
  tip: [],
  tipEnabled: false,
  credits: { design: [], art: [] },
  designEnabled: false,
  artEnabled: false,
  hasPinTips: false,
};

// jsdom has no FontFaceSet; the face waits on it before fitting the title.
Object.defineProperty(document, "fonts", {
  configurable: true,
  value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
});

describe("ApronCardFace action rows", () => {
  it("names playing tips last, only for a machine with tips (spec 5.3–5.4)", () => {
    const { rerender } = render(
      <ApronCardFace
        content={{ ...content, hasPinTips: true }}
        size="stern"
        scanUrl="https://example.test/m/GDZ/hub?source=apron"
      />
    );
    const rows = document.querySelectorAll(".apron-card__action");
    expect([...rows].map((row) => row.textContent)).toEqual([
      "Report a problem",
      "Post your score on iScored",
      "Get playing tips",
    ]);

    rerender(
      <ApronCardFace
        content={content}
        size="stern"
        scanUrl="https://example.test/m/GDZ/hub?source=apron"
      />
    );
    expect(screen.queryByText("Get playing tips")).not.toBeInTheDocument();
  });
});

describe("ApronCardFace card text", () => {
  it("prints bold, italic, and lists (spec 3.7)", () => {
    render(
      <ApronCardFace
        content={{
          ...content,
          description: [
            {
              kind: "paragraph",
              runs: [{ text: "Hit the " }, { text: "ramps", bold: true }],
            },
            {
              kind: "list",
              ordered: true,
              items: [
                [{ text: "Lock", italic: true }],
                [{ text: "Multiball" }],
              ],
            },
          ],
        }}
        size="stern"
        scanUrl="https://example.test/m/GDZ/hub?source=apron"
      />
    );
    expect(screen.getByText("ramps").tagName).toBe("STRONG");
    expect(screen.getByText("Lock").tagName).toBe("EM");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Lock",
      "Multiball",
    ]);
    expect(items[0]?.parentElement?.tagName).toBe("OL");
  });
});
