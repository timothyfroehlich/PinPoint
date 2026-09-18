"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { getIscoredGamesAction } from "~/app/(app)/m/iscored-actions";
import type { IscoredGame } from "~/lib/iscored/types";

export interface IscoredGamePickerProps {
  defaultGameId?: string | null;
  machineName?: string;
  disabled?: boolean;
  onDirty?: () => void;
}

/**
 * Normalizes a machine or game title for basic fuzzy comparison:
 * lowercase, removes bracketed/parenthetical qualifiers like "(LE)", "[Pro]", or "(Stern 2022)",
 * and replaces punctuation with whitespace.
 */
export function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Identifies the best suggested iScored game match for a given machine name.
 * Keeps matching simple: exact clean title match -> prefix match -> substring match.
 * Prefers the longest matching candidate and guards against empty/short game names.
 */
export function findSuggestedGame(
  machineName: string | undefined,
  games: IscoredGame[]
): IscoredGame | null {
  if (!machineName?.trim() || games.length === 0) {
    return null;
  }

  const cleanTarget = normalizeGameName(machineName);
  if (!cleanTarget) {
    return null;
  }

  // 1. Exact match after normalization
  const exact = games.find(
    (g) => normalizeGameName(g.gameName) === cleanTarget
  );
  if (exact) {
    return exact;
  }

  // Filter out any games that normalize to empty or single-character strings
  const validGames = games.filter((g) => {
    const cleanG = normalizeGameName(g.gameName);
    return cleanG.length >= 2;
  });

  // 2. Prefix match - pick the candidate with the longest matching prefix length
  let bestPrefix: { game: IscoredGame; len: number } | null = null;
  for (const g of validGames) {
    const cleanG = normalizeGameName(g.gameName);
    if (cleanG.startsWith(cleanTarget) || cleanTarget.startsWith(cleanG)) {
      const matchLen = Math.min(cleanG.length, cleanTarget.length);
      if (!bestPrefix || matchLen > bestPrefix.len) {
        bestPrefix = { game: g, len: matchLen };
      }
    }
  }
  if (bestPrefix) {
    return bestPrefix.game;
  }

  // 3. Substring match - require at least 3 characters on both sides
  if (cleanTarget.length >= 3) {
    let bestSubstring: { game: IscoredGame; len: number } | null = null;
    for (const g of validGames) {
      const cleanG = normalizeGameName(g.gameName);
      if (cleanG.length >= 3) {
        if (cleanG.includes(cleanTarget) || cleanTarget.includes(cleanG)) {
          const matchLen = Math.min(cleanG.length, cleanTarget.length);
          if (!bestSubstring || matchLen > bestSubstring.len) {
            bestSubstring = { game: g, len: matchLen };
          }
        }
      }
    }
    if (bestSubstring) {
      return bestSubstring.game;
    }
  }

  return null;
}

/**
 * Searchable picker for linking a machine to its iScored scoreboard game.
 *
 * Follows the standard PinPoint Popover + cmdk Command pattern.
 * Floats the auto-matched game to the top with a "Suggested match" badge
 * without forcibly pre-selecting it. Submits via a hidden `iscoredGameId` input.
 */
export function IscoredGamePicker({
  defaultGameId,
  machineName,
  disabled = false,
  onDirty,
}: IscoredGamePickerProps): React.JSX.Element {
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>(
    defaultGameId ? String(defaultGameId).trim() : ""
  );
  const [games, setGames] = useState<IscoredGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadGames(): Promise<void> {
      setLoading(true);
      try {
        const result = await getIscoredGamesAction();
        if (cancelled) return;

        if ("error" in result) {
          setFetchFailed(true);
        } else if (result.games.length === 0) {
          // If the gameroom has no games or list couldn't be loaded, fall back to manual entry
          setFetchFailed(true);
        } else {
          setGames(result.games);
          setFetchFailed(false);
        }
      } catch {
        if (!cancelled) {
          setFetchFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadGames();

    return () => {
      cancelled = true;
    };
  }, []);

  // Update selected game ID when defaultGameId prop updates
  useEffect(() => {
    setSelectedGameId(defaultGameId ? String(defaultGameId).trim() : "");
  }, [defaultGameId]);

  const suggestedGame = useMemo(() => {
    return findSuggestedGame(machineName, games);
  }, [machineName, games]);

  // Float suggested match to top of the list
  const sortedGames = useMemo(() => {
    if (!suggestedGame) {
      return games;
    }
    return [
      suggestedGame,
      ...games.filter((g) => g.gameId !== suggestedGame.gameId),
    ];
  }, [games, suggestedGame]);

  const displayLabel = useMemo(() => {
    if (!selectedGameId) {
      return "Search iScored games…";
    }
    const matched = games.find((g) => g.gameId === selectedGameId);
    if (matched) {
      return `${matched.gameName} (#${matched.gameId})`;
    }
    if (loading) {
      return "Loading…";
    }
    return `iScored Game #${selectedGameId}`;
  }, [selectedGameId, games, loading]);

  const handleSelectGame = (gameId: string): void => {
    setSelectedGameId(gameId);
    setOpen(false);
    onDirty?.();
  };

  const handleClear = (): void => {
    setSelectedGameId("");
    onDirty?.();
  };

  // Fallback to text input if upstream fetch failed or is unconfigured
  if (fetchFailed) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={triggerId} className="text-foreground">
          iScored Game ID
        </Label>
        <Input
          id={triggerId}
          name="iscoredGameId"
          type="text"
          value={selectedGameId}
          onChange={(e) => {
            setSelectedGameId(e.target.value);
            onDirty?.();
          }}
          placeholder="e.g., 73"
          autoComplete="off"
          disabled={disabled}
          className="border-outline bg-surface text-foreground placeholder:text-muted-foreground"
          data-testid="edit-machine-iscored-game-id"
        />
        <p className="text-xs text-muted-foreground">
          Game identifier on iScored.info. Leave blank to unlink.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        type="hidden"
        name="iscoredGameId"
        value={selectedGameId}
        data-testid="edit-machine-iscored-game-id"
      />
      <Label htmlFor={triggerId} className="text-foreground">
        iScored Game
      </Label>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              id={triggerId}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-controls={open ? `${triggerId}-listbox` : undefined}
              disabled={disabled || loading}
              data-testid="iscored-game-picker-trigger"
              className="w-full justify-between border-outline bg-surface text-foreground font-normal"
            >
              <span
                className={
                  selectedGameId
                    ? "truncate text-foreground"
                    : "truncate text-muted-foreground"
                }
              >
                {displayLabel}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            id={`${triggerId}-listbox`}
            className="w-(--radix-popover-trigger-width) p-0"
            align="start"
          >
            <Command>
              <CommandInput
                placeholder="Search iScored games…"
                autoComplete="off"
              />
              <CommandList>
                <CommandEmpty>No games found.</CommandEmpty>
                <CommandGroup>
                  {sortedGames.map((game) => {
                    const isSelected = selectedGameId === game.gameId;
                    const isSuggested = suggestedGame?.gameId === game.gameId;
                    return (
                      <CommandItem
                        key={game.gameId}
                        value={`${game.gameName} ${game.gameId}`}
                        onSelect={() => handleSelectGame(game.gameId)}
                        data-testid={`iscored-game-option-${game.gameId}`}
                        className="flex items-center justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <Check
                            className={cn(
                              "size-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">{game.gameName}</span>
                          {isSuggested && (
                            <span
                              data-testid="iscored-suggested-badge"
                              className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                            >
                              Suggested match
                            </span>
                          )}
                        </div>
                        <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
                          #{game.gameId}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedGameId.length > 0 && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            data-testid="iscored-clear-button"
            className="h-9 shrink-0 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Link this machine to its iScored scoreboard game. Leave unselected to
        unlink.
      </p>
    </div>
  );
}
