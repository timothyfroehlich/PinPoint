import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateMachineForm } from "./create-machine-form";
import { createMachineAction } from "~/app/(app)/m/actions";
import { getIscoredGamesAction } from "~/app/(app)/m/iscored-actions";

vi.mock("~/app/(app)/m/actions", () => ({
  createMachineAction: vi.fn(),
}));

vi.mock("~/app/(app)/m/iscored-actions", () => ({
  getIscoredGamesAction: vi.fn(),
}));

vi.mock("~/components/editor/RichTextEditorDynamic", () => ({
  RichTextEditor: () => <div data-testid="mock-rich-text-editor" />,
}));

vi.mock("~/components/machines/OwnerSelect", () => ({
  OwnerSelect: () => <div data-testid="mock-owner-select" />,
}));

vi.mock("~/components/machines/PinballMapLinkField", () => ({
  PinballMapLinkField: () => <div data-testid="mock-pbm-link-field" />,
}));

describe("CreateMachineForm — iScored picker integration", () => {
  const mockGames = [
    { gameId: "77956", gameName: "Medieval Madness" },
    { gameId: "104656", gameName: "Demolition Man" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIscoredGamesAction).mockResolvedValue({ games: mockGames });
    vi.mocked(createMachineAction).mockResolvedValue({
      ok: true,
      value: {
        machineId: "mock-machine-uuid",
        redirectTo: "/m/MM",
      },
    });
  });

  it("does not render iScored picker when iscoredConfigured is false or omitted", () => {
    render(<CreateMachineForm allUsers={[]} canSelectOwner={false} />);
    expect(
      screen.queryByTestId("iscored-game-picker-trigger")
    ).not.toBeInTheDocument();
  });

  it("renders iScored picker when iscoredConfigured is true", async () => {
    render(
      <CreateMachineForm
        allUsers={[]}
        canSelectOwner={false}
        iscoredConfigured={true}
      />
    );

    await waitFor(() => {
      expect(getIscoredGamesAction).toHaveBeenCalled();
    });

    expect(
      screen.getByTestId("iscored-game-picker-trigger")
    ).toBeInTheDocument();
  });

  it("submits selected iScored game ID with form submission", async () => {
    const user = userEvent.setup();
    render(
      <CreateMachineForm
        allUsers={[]}
        canSelectOwner={false}
        iscoredConfigured={true}
      />
    );

    // Fill required fields
    await user.type(screen.getByLabelText(/Machine Name/), "Medieval Madness");
    await user.type(screen.getByLabelText(/Initials/), "MM");

    // Open picker and choose Demolition Man (#104656)
    await user.click(screen.getByTestId("iscored-game-picker-trigger"));
    const option = await screen.findByTestId("iscored-game-option-104656");
    await user.click(option);

    // Submit form
    await user.click(screen.getByRole("button", { name: /Create Machine/i }));

    await waitFor(() => {
      expect(createMachineAction).toHaveBeenCalled();
    });

    const fd = vi.mocked(createMachineAction).mock.calls[0]?.[1];
    expect(fd).toBeInstanceOf(FormData);
    expect(fd?.get("name")).toBe("Medieval Madness");
    expect(fd?.get("initials")).toBe("MM");
    expect(fd?.get("iscoredGameId")).toBe("104656");
  });
});
