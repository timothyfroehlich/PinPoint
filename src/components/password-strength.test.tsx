import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PasswordStrength } from "~/components/password-strength";

describe("PasswordStrength", () => {
  it("renders nothing for a password under 8 characters", () => {
    const { container } = render(<PasswordStrength password="abc123" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["password123", "Too weak"],
    ["Summer2024!", "Fair"],
    ["correct horse battery staple Zebra", "Strong"],
  ])("labels %s as %s", async (password, label) => {
    render(<PasswordStrength password={password} />);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("shows the warning and suggestions for a weak password", async () => {
    render(<PasswordStrength password="password123" />);
    expect(
      await screen.findByText("• This is a commonly used password.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("• Add more words that are less common.")
    ).toBeInTheDocument();
  });

  it("shows no feedback list for a strong password", async () => {
    render(<PasswordStrength password="correct horse battery staple Zebra" />);
    await screen.findByText("Strong");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
