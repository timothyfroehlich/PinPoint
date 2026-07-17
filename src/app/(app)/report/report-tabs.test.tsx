import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { ReportTabs } from "./report-tabs";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/report"),
}));

describe("ReportTabs", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/report");
  });

  it("marks Single active on /report and links both tabs", () => {
    vi.mocked(usePathname).mockReturnValue("/report");
    render(<ReportTabs canQuick={true} />);

    const single = screen.getByRole("link", { name: /single issue/i });
    const multiple = screen.getByRole("link", { name: /multiple/i });

    expect(single).toHaveAttribute("href", "/report");
    expect(multiple).toHaveAttribute("href", "/report/quick");
    expect(single).toHaveAttribute("aria-current", "page");
    expect(multiple).not.toHaveAttribute("aria-current");
  });

  it("marks Multiple active on /report/quick", () => {
    vi.mocked(usePathname).mockReturnValue("/report/quick");
    render(<ReportTabs canQuick={true} />);

    expect(screen.getByRole("link", { name: /multiple/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: /single issue/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing when the user lacks quick-report permission", () => {
    const { container } = render(<ReportTabs canQuick={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link", { name: /multiple/i })).toBeNull();
  });
});
