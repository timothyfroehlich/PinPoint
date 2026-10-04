"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

const SEARCH_DEBOUNCE_MS = 250;

interface ListSearchFieldProps {
  id: string;
  /** The search the list currently shows. */
  value: string;
  /**
   * Runs a search; called 250 ms after typing stops, or on Enter (§4.1). A
   * delayed search calls the latest `onSearch`, so it joins whatever else
   * changed while it waited.
   */
  onSearch: (query: string) => void;
  /** Accessible name, such as "Search machines". */
  label: string;
  /** Names what the search covers (§4.2). */
  placeholder: string;
}

/**
 * The List View search field (list-views §4.1, §4.2). It keeps the person's
 * typing while an earlier search's results arrive, and takes a new value
 * only when the list's search changes from elsewhere. List View mounts it
 * afresh when a view is applied or changes are discarded, which drops a
 * search still waiting to run.
 */
export function ListSearchField({
  id,
  value,
  onSearch,
  label,
  placeholder,
}: ListSearchFieldProps): React.JSX.Element {
  const [text, setText] = React.useState(value);
  const submitted = React.useRef(value);
  const timeout = React.useRef<number | null>(null);
  const onSearchRef = React.useRef(onSearch);
  React.useLayoutEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  const clearPending = React.useCallback((): void => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  React.useEffect(() => {
    if (value === submitted.current) return;
    clearPending();
    submitted.current = value;
    setText(value);
  }, [clearPending, value]);

  const submit = React.useCallback(
    (raw: string): void => {
      clearPending();
      const query = raw.trim();
      if (query === submitted.current) return;
      submitted.current = query;
      onSearchRef.current(query);
    },
    [clearPending]
  );

  React.useEffect(() => clearPending, [clearPending]);

  function change(next: string): void {
    setText(next);
    clearPending();
    timeout.current = window.setTimeout(() => submit(next), SEARCH_DEBOUNCE_MS);
  }

  return (
    <search className="relative flex items-center">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit(text);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 bg-background pl-9 text-base md:h-9 md:text-sm"
      />
    </search>
  );
}
