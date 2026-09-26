import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  link: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock("~/app/(app)/settings/pinballmap/actions", () => ({
  linkPinballMapAccountAction: actions.link,
  unlinkPinballMapAccountAction: actions.unlink,
}));

import { PinballMapAccountRow } from "./pinballmap-account-row";

beforeEach(() => {
  actions.link.mockReset();
  actions.unlink.mockReset();
});

describe("PinballMapAccountRow (pinballmap spec 8.4–8.5)", () => {
  it("offers Link when not linked, and no Unlink", () => {
    render(
      <PinballMapAccountRow status="not_linked" username={null} canLink />
    );
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Link Pinball Map" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Unlink" })
    ).not.toBeInTheDocument();
  });

  it("shows the linked username with Unlink only", () => {
    render(<PinballMapAccountRow status="linked" username="ssw" canLink />);
    expect(screen.getByTestId("pinballmap-account-status")).toHaveTextContent(
      "Linked as ssw"
    );
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /link pinball map|reconnect/i })
    ).not.toBeInTheDocument();
  });

  it("shows Authentication failed with Reconnect and Unlink", () => {
    render(
      <PinballMapAccountRow status="needs_relink" username="ssw" canLink />
    );
    expect(screen.getByTestId("pinballmap-account-status")).toHaveTextContent(
      "Authentication failed"
    );
    expect(screen.getByText("Was linked as ssw.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reconnect" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
  });

  it("offers only Unlink to someone who can no longer link", () => {
    render(
      <PinballMapAccountRow
        status="needs_relink"
        username="ssw"
        canLink={false}
      />
    );
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reconnect" })
    ).not.toBeInTheDocument();
  });

  it("keeps the login and shows Pinball Map's message when sign-in fails", async () => {
    const user = userEvent.setup();
    actions.link.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect password",
    });
    render(
      <PinballMapAccountRow status="not_linked" username={null} canLink />
    );

    await user.click(screen.getByRole("button", { name: "Link Pinball Map" }));
    await user.type(screen.getByLabelText("Username or email"), "ssw");
    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Link account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect password"
    );
    expect(screen.getByLabelText("Username or email")).toHaveValue("ssw");
    const form = actions.link.mock.calls[0]?.[1] as FormData;
    expect(form.get("login")).toBe("ssw");
    expect(form.get("password")).toBe("nope");
  });

  it("does not carry a failed attempt's error into the next open", async () => {
    const user = userEvent.setup();
    actions.link.mockResolvedValue({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect password",
    });
    render(
      <PinballMapAccountRow status="not_linked" username={null} canLink />
    );

    await user.click(screen.getByRole("button", { name: "Link Pinball Map" }));
    await user.type(screen.getByLabelText("Username or email"), "ssw");
    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Link account" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Link Pinball Map" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Username or email")).toHaveValue("");
  });

  it("confirms Unlink with the cannot-revoke caveat before calling the action", async () => {
    const user = userEvent.setup();
    actions.unlink.mockResolvedValue({ ok: true, value: {} });
    render(<PinballMapAccountRow status="linked" username="ssw" canLink />);

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(
      screen.getByText(/Pinball Map has no way to revoke a token/)
    ).toBeInTheDocument();
    expect(actions.unlink).not.toHaveBeenCalled();

    const dialog = screen.getByRole("alertdialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Unlink"
    );
    if (!confirm) throw new Error("no confirm button");
    await user.click(confirm);
    await waitFor(() => {
      expect(actions.unlink).toHaveBeenCalledTimes(1);
    });
  });
});
