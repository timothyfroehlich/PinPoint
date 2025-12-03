import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SaveCancelButtons } from "./save-cancel-buttons";

describe("SaveCancelButtons", () => {
  it("should render default save label", () => {
    render(<SaveCancelButtons isPending={false} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should render custom save label", () => {
    render(
      <SaveCancelButtons
        isPending={false}
        onCancel={vi.fn()}
        saveLabel="Update Profile"
      />
    );
    expect(
      screen.getByRole("button", { name: "Update Profile" })
    ).toBeInTheDocument();
  });

  it("should show saving state when pending", () => {
    render(<SaveCancelButtons isPending={true} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("should show success state when success", () => {
    render(
      <SaveCancelButtons
        isPending={false}
        isSuccess={true}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /saved/i })).toBeDisabled();
  });

  it("should revert to default state after 3 seconds", () => {
    vi.useFakeTimers();

    render(
      <SaveCancelButtons
        isPending={false}
        isSuccess={true}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /saved/i })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /saved/i })
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("should call onCancel when cancel clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<SaveCancelButtons isPending={false} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
