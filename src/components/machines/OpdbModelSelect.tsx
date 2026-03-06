"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { formatOpdbModelLabel } from "~/lib/opdb/mappers";
import {
  opdbSearchResponseSchema,
  type OpdbModelSelection,
  type OpdbSearchResult,
} from "~/lib/opdb/types";

interface OpdbModelSelectProps {
  selectedModel: OpdbModelSelection | null;
  onSelect: (selection: OpdbModelSelection | null) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

export function OpdbModelSelect({
  selectedModel,
  onSelect,
  id = "opdb-model-search",
  name = "opdbId",
  disabled,
  allowClear = true,
}: OpdbModelSelectProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpdbSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    skipNextSearchRef.current = true;
    setQuery(
      selectedModel
        ? formatOpdbModelLabel({
            title: selectedModel.title,
            manufacturer: selectedModel.manufacturer,
            year: selectedModel.year,
          })
        : ""
    );
    setResults([]);
    setError(null);
  }, [selectedModel]);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const runSearch = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/opdb/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          setResults([]);
          setError("Could not search OPDB right now.");
          return;
        }

        const payload: unknown = await response.json();
        const parsed = opdbSearchResponseSchema.safeParse(payload);
        if (!parsed.success) {
          setResults([]);
          setError("Received an invalid response from OPDB search.");
          return;
        }

        setResults(parsed.data.results);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setResults([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not search OPDB right now."
        );
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      void runSearch();
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const handleSelect = (result: OpdbSearchResult): void => {
    onSelect({
      id: result.id,
      title: result.title,
      manufacturer: result.manufacturer,
      year: result.year,
    });
  };

  const selectedLabel = selectedModel
    ? formatOpdbModelLabel({
        title: selectedModel.title,
        manufacturer: selectedModel.manufacturer,
        year: selectedModel.year,
      })
    : null;
  const shouldShowResults = isLoading || error !== null || results.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-on-surface">
        OPDB Model
      </Label>

      <input type="hidden" name={name} value={selectedModel?.id ?? ""} />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant/70" />
        <Input
          id={id}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search OPDB models (e.g., Medieval Madness)"
          disabled={disabled}
          autoComplete="off"
          className="border-outline bg-surface pr-10 pl-9 text-on-surface placeholder:text-on-surface-variant"
          data-testid="opdb-model-search-input"
        />
        {isLoading && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-on-surface-variant/70" />
        )}
      </div>

      {selectedLabel && (
        <div className="flex items-center justify-between rounded-md border border-outline-variant bg-surface-container px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-on-surface">
              {selectedLabel}
            </p>
            <p className="text-xs text-on-surface-variant">
              ID: {selectedModel?.id}
            </p>
          </div>
          {allowClear && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSelect(null)}
              className="size-8"
              data-testid="opdb-model-clear"
            >
              <X className="size-4" />
              <span className="sr-only">Clear OPDB model</span>
            </Button>
          )}
        </div>
      )}

      {shouldShowResults && (
        <div
          className={cn(
            "max-h-56 overflow-y-auto rounded-md border border-outline-variant bg-surface",
            isLoading && "opacity-80"
          )}
          data-testid="opdb-model-results"
        >
          {error && (
            <p className="px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          {!error &&
            results.map((result, index) => {
              const label = formatOpdbModelLabel({
                title: result.title,
                manufacturer: result.manufacturer,
                year: result.year,
              });

              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="block w-full border-b border-outline-variant/40 px-3 py-2 text-left text-sm text-on-surface transition-colors last:border-b-0 hover:bg-surface-variant"
                  data-testid={`opdb-model-result-${index}`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-on-surface-variant">
                    {result.id}
                  </div>
                </button>
              );
            })}

          {!error && !isLoading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-on-surface-variant">
              No models found.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-on-surface-variant">
        Select a model to import locked OPDB metadata (name, manufacturer, and
        year).
      </p>
    </div>
  );
}
