import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaveFailureBanner } from "~/components/machines/settings/SaveFailureBanner";

describe("SaveFailureBanner", () => {
  it("renders nothing when there are no failures", () => {
    const { container } = render(
      <SaveFailureBanner failedCount={0} onRetry={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an alert with a working Retry when there are failures", async () => {
    const onRetry = vi.fn();
    render(<SaveFailureBanner failedCount={2} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
