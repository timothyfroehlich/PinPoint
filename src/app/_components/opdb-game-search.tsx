"use client";

import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Games, Search } from "@mui/icons-material";
import { useState, useCallback } from "react";
import { useDebounce } from "~/lib/hooks/use-debounce";
import { api } from "~/trpc/react";
import type { OPDBSearchResult } from "~/lib/opdb";

interface OPDBGameSearchProps {
  onGameSelect: (opdbId: string, gameData: OPDBSearchResult) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  fullWidth?: boolean;
  error?: boolean;
  helperText?: string;
}

export function OPDBGameSearch({
  onGameSelect,
  disabled = false,
  label = "Search OPDB Games",
  placeholder = "Search for pinball machines...",
  fullWidth = true,
  error = false,
  helperText,
}: OPDBGameSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedGame, setSelectedGame] = useState<OPDBSearchResult | null>(
    null,
  );

  // Debounce search input to avoid excessive API calls
  const debouncedQuery = useDebounce(inputValue, 300);

  // OPDB search query
  const {
    data: searchResults = [],
    isLoading: isSearching,
    error: searchError,
  } = api.gameTitle.searchOPDB.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.length >= 2, // Only search with 2+ characters
      staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    },
  );

  const handleGameSelection = useCallback(
    (game: OPDBSearchResult | null) => {
      setSelectedGame(game);
      if (game) {
        onGameSelect(game.id, game);
      }
    },
    [onGameSelect],
  );

  const handleInputChange = useCallback(
    (_: React.SyntheticEvent, newInputValue: string) => {
      setInputValue(newInputValue);
      // Clear selection if input is cleared
      if (!newInputValue && selectedGame) {
        setSelectedGame(null);
      }
    },
    [selectedGame],
  );

  // Format game display text with manufacturer and year if available
  const formatGameText = (game: OPDBSearchResult): string => {
    const text = game.text;

    // Extract additional info from OPDB search result
    // OPDB search results often include manufacturer/year in the text
    return text;
  };

  return (
    <Box>
      <Autocomplete
        options={searchResults}
        value={selectedGame}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={(_, newValue) => handleGameSelection(newValue)}
        getOptionLabel={(option) => formatGameText(option)}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        loading={isSearching}
        disabled={disabled}
        fullWidth={fullWidth}
        filterOptions={(x) => x} // Don't filter - use server results
        noOptionsText={
          debouncedQuery.length < 2
            ? "Type at least 2 characters to search..."
            : isSearching
              ? "Searching..."
              : "No games found"
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            error={error}
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  <Search color="action" />
                </Box>
              ),
              endAdornment: (
                <>
                  {isSearching && (
                    <CircularProgress color="inherit" size={20} />
                  )}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                width: "100%",
              }}
            >
              <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40 }}>
                <Games />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: "medium" }}>
                  {formatGameText(option)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  OPDB ID: {option.id}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
        sx={{
          "& .MuiOutlinedInput-root": {
            paddingLeft: 1,
          },
        }}
      />

      {searchError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          Search failed: {searchError.message}
        </Alert>
      )}

      {selectedGame && (
        <Box sx={{ mt: 2 }}>
          <Chip
            icon={<Games />}
            label={`Selected: ${formatGameText(selectedGame)}`}
            color="primary"
            variant="outlined"
            onDelete={() => {
              setSelectedGame(null);
              setInputValue("");
            }}
          />
        </Box>
      )}
    </Box>
  );
}
