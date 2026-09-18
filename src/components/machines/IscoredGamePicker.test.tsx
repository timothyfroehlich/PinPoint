import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  findSuggestedGame,
  IscoredGamePicker,
  normalizeGameName,
} from "./IscoredGamePicker";
import { getIscoredGamesAction } from "~/app/(app)/m/iscored-actions";
import type { IscoredGame } from "~/lib/iscored/types";

vi.mock("~/app/(app)/m/iscored-actions", () => ({
  getIscoredGamesAction: vi.fn(),
}));

const mockGames: IscoredGame[] = [
  { gameId: "77956", gameName: "Medieval Madness" },
  { gameId: "104656", gameName: "Demolition Man" },
  { gameId: "79212", gameName: "Game of Thrones (half-height)" },
  { gameId: "88990", gameName: "Rush (LE) (Stern 2022)" },
];

function submittedValue(): string | undefined {
  return document.querySelector<HTMLInputElement>('input[name="iscoredGameId"]')
    ?.value;
}

describe("IscoredGamePicker helper functions", () => {
  it("normalizeGameName strips parentheticals, brackets, and punctuation", () => {
    expect(normalizeGameName("Rush (LE) (Stern 2022)")).toBe("rush");
    expect(normalizeGameName("Godzilla [Pro]")).toBe("godzilla");
    expect(normalizeGameName("Medieval Madness!")).toBe("medieval madness");
  });

  it("findSuggestedGame matches exact, prefix, or substring", () => {
    expect(findSuggestedGame("Demolition Man", mockGames)).toEqual(
      mockGames[1]
    );
    expect(findSuggestedGame("Rush", mockGames)).toEqual(mockGames[3]);
    expect(findSuggestedGame("Thrones", mockGames)).toEqual(mockGames[2]);
    expect(findSuggestedGame("Non-existent Machine", mockGames)).toBeNull();
    expect(findSuggestedGame("", mockGames)).toBeNull();
  });

  it("does not match games that normalize to empty or single-character strings", () => {
    const emptyGames: IscoredGame[] = [
      { gameId: "99", gameName: "(1978)" },
      { gameId: "100", gameName: "---" },
      { gameId: "101", gameName: "X" },
    ];
    expect(findSuggestedGame("Medieval Madness", emptyGames)).toBeNull();
    expect(findSuggestedGame("Batman", emptyGames)).toBeNull();
  });

  it("prefers the longer/more specific prefix match when multiple match", () => {
    const starGames: IscoredGame[] = [
      { gameId: "1", gameName: "Star" },
      { gameId: "2", gameName: "Star Wars" },
    ];
    expect(findSuggestedGame("Star Wars Premium", starGames)).toEqual(
      starGames[1]
    );
  });
});

describe("IscoredGamePicker component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIscoredGamesAction).mockResolvedValue({ games: mockGames });
  });

  it("renders trigger and hidden input with empty initial value", async () => {
    render(<IscoredGamePicker />);

    await waitFor(() => {
      expect(getIscoredGamesAction).toHaveBeenCalled();
    });

    expect(
      screen.getByTestId("iscored-game-picker-trigger")
    ).toBeInTheDocument();
    expect(submittedValue()).toBe("");
  });

  it("disables trigger and hides clear button when disabled is true", async () => {
    render(<IscoredGamePicker defaultGameId="104656" disabled={true} />);

    await waitFor(() => {
      expect(getIscoredGamesAction).toHaveBeenCalled();
    });

    const trigger = screen.getByTestId("iscored-game-picker-trigger");
    expect(trigger).toBeDisabled();
    expect(
      screen.queryByTestId("iscored-clear-button")
    ).not.toBeInTheDocument();
  });

  it("initializes with defaultGameId immediately without waiting for fetch", () => {
    vi.mocked(getIscoredGamesAction).mockReturnValue(
      new Promise(() => undefined)
    );
    render(<IscoredGamePicker defaultGameId="104656" />);

    expect(submittedValue()).toBe("104656");
  });

  it("displays resolved game name when defaultGameId is loaded", async () => {
    render(<IscoredGamePicker defaultGameId="104656" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("iscored-game-picker-trigger")
      ).toHaveTextContent("Demolition Man (#104656)");
    });
    expect(submittedValue()).toBe("104656");
  });

  it("displays fallback identifier if defaultGameId is not in games list", async () => {
    render(<IscoredGamePicker defaultGameId="99999" />);

    await waitFor(() => {
      expect(
        screen.getByTestId("iscored-game-picker-trigger")
      ).toHaveTextContent("iScored Game #99999");
    });
    expect(submittedValue()).toBe("99999");
  });

  it("floats suggested match to top with badge without forcibly preselecting", async () => {
    const user = userEvent.setup();
    render(<IscoredGamePicker machineName="Medieval Madness" />);

    await waitFor(() => {
      expect(getIscoredGamesAction).toHaveBeenCalled();
    });

    // Hidden input remains empty (not forcibly pre-selected)
    expect(submittedValue()).toBe("");

    // Open combobox popover
    await user.click(screen.getByTestId("iscored-game-picker-trigger"));

    // Check that suggested badge is present
    const badge = await screen.findByTestId("iscored-suggested-badge");
    expect(badge).toHaveTextContent("Suggested match");

    // The option for Medieval Madness has the badge
    const mmOption = screen.getByTestId("iscored-game-option-77956");
    expect(mmOption).toContainElement(badge);
  });

  it("allows selecting a game and marks dirty", async () => {
    const user = userEvent.setup();
    const onDirty = vi.fn();
    render(<IscoredGamePicker onDirty={onDirty} />);

    await waitFor(() => {
      expect(getIscoredGamesAction).toHaveBeenCalled();
    });

    await user.click(screen.getByTestId("iscored-game-picker-trigger"));

    const option = await screen.findByTestId("iscored-game-option-104656");
    await user.click(option);

    expect(submittedValue()).toBe("104656");
    expect(screen.getByTestId("iscored-game-picker-trigger")).toHaveTextContent(
      "Demolition Man (#104656)"
    );
    expect(onDirty).toHaveBeenCalledTimes(1);
  });

  it("allows clearing selected game via Clear button", async () => {
    const user = userEvent.setup();
    const onDirty = vi.fn();
    render(<IscoredGamePicker defaultGameId="104656" onDirty={onDirty} />);

    await waitFor(() => {
      expect(screen.getByTestId("iscored-clear-button")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("iscored-clear-button"));

    expect(submittedValue()).toBe("");
    expect(screen.getByTestId("iscored-game-picker-trigger")).toHaveTextContent(
      "Search iScored games…"
    );
    expect(onDirty).toHaveBeenCalledTimes(1);
  });

  it("renders manual input fallback when getIscoredGamesAction fails", async () => {
    vi.mocked(getIscoredGamesAction).mockResolvedValue({
      error: "API unreachable",
    });
    const onDirty = vi.fn();

    render(<IscoredGamePicker defaultGameId="55" onDirty={onDirty} />);

    const input = await screen.findByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("55");
    expect(input).toHaveAttribute("autocomplete", "off");

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, "88");

    expect(input).toHaveValue("88");
    expect(onDirty).toHaveBeenCalled();
  });

  it("renders manual input fallback when games array is empty", async () => {
    vi.mocked(getIscoredGamesAction).mockResolvedValue({
      games: [],
    });

    render(<IscoredGamePicker defaultGameId="42" />);

    const input = await screen.findByRole("textbox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("42");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("sets autocomplete off on the combobox search input", async () => {
    vi.mocked(getIscoredGamesAction).mockResolvedValue({
      games: mockGames,
    });

    render(<IscoredGamePicker />);

    const trigger = await screen.findByTestId("iscored-game-picker-trigger");
    const user = userEvent.setup();
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText("Search iScored games…");
    expect(searchInput).toHaveAttribute("autocomplete", "off");
  });
});
