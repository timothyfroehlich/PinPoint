"use client";

import type React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Responsive Preview (client component) — rendered by the server wrapper
 * in page.tsx which gates access to development mode only.
 */

/** Validate that a path is a safe same-origin relative path */
function sanitizePath(input: string): string {
  const trimmed = input.trim();
  // Must start with / and not contain protocol schemes
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes(":")
  ) {
    return "/dev/design-system";
  }
  return trimmed;
}

const STORAGE_KEY = "pinpoint-preview-state";

interface PreviewState {
  path: string;
  viewMode: "both" | "desktop" | "mobile";
  mobileWidth: number;
  hideChrome: boolean;
}

const DEFAULTS: PreviewState = {
  path: "/dev/design-system",
  viewMode: "both",
  mobileWidth: 390,
  hideChrome: true,
};

function loadState(searchParamPath: string | null): PreviewState {
  // URL param takes priority for path
  if (searchParamPath) {
    const saved = loadSavedState();
    return { ...saved, path: sanitizePath(searchParamPath) };
  }
  return loadSavedState();
}

function loadSavedState(): PreviewState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<PreviewState>;
    return {
      ...DEFAULTS,
      ...parsed,
      path: sanitizePath(parsed.path ?? DEFAULTS.path),
    };
  } catch {
    return DEFAULTS;
  }
}

function saveState(state: PreviewState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

/** CSS injected into iframes to strip MainLayout chrome */
const EMBED_CSS = `
  /* Hide sidebar */
  .flex.h-full > aside { display: none !important; }
  /* Hide mobile header */
  [data-testid="mobile-header"] { display: none !important; }
  /* Hide desktop header */
  main > header { display: none !important; }
  /* Hide bottom tab bar */
  [data-testid="bottom-tab-bar"] { display: none !important; }
  /* Remove bottom padding reserved for tab bar */
  .pb-\\[calc\\(88px\\+env\\(safe-area-inset-bottom\\)\\)\\] { padding-bottom: 0 !important; }
  /* Remove scroll padding for hidden header */
  .scroll-pt-\\[52px\\] { scroll-padding-top: 0 !important; }
`;

export function PreviewClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const searchParamPath = searchParams.get("path");

  const [state, setStateRaw] = useState<PreviewState>(() =>
    loadState(searchParamPath)
  );
  const [inputValue, setInputValue] = useState(state.path);
  const desktopRef = useRef<HTMLIFrameElement>(null);
  const mobileRef = useRef<HTMLIFrameElement>(null);

  // Persist to localStorage on every change
  const setState = useCallback((update: Partial<PreviewState>) => {
    setStateRaw((prev) => {
      const next = { ...prev, ...update };
      saveState(next);
      return next;
    });
  }, []);

  // Sync input value when path changes via preset buttons
  useEffect(() => {
    setInputValue(state.path);
  }, [state.path]);

  const injectStyles = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      if (!iframe || !state.hideChrome) return;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.getElementById("embed-styles")?.remove();
        const style = doc.createElement("style");
        style.id = "embed-styles";
        style.textContent = EMBED_CSS;
        doc.head.appendChild(style);
      } catch {
        // Cross-origin — can't inject
      }
    },
    [state.hideChrome]
  );

  const presets = [
    { label: "Design System", path: "/dev/design-system" },
    { label: "Dashboard", path: "/dashboard" },
    { label: "Issues", path: "/issues" },
    { label: "Machines", path: "/m" },
    { label: "Machine Detail", path: "/m/GDZ" },
    { label: "Issue Detail", path: "/m/GDZ/i/2" },
    { label: "Settings", path: "/settings" },
    { label: "Help", path: "/help" },
    { label: "Report", path: "/report" },
  ];

  const mobilePresets = [
    { label: "iPhone SE", width: 375 },
    { label: "iPhone 15", width: 390 },
    { label: "iPhone 15 Pro Max", width: 430 },
    { label: "Pixel 7", width: 412 },
    { label: "iPad Mini", width: 768 },
  ];

  const { path, viewMode, mobileWidth, hideChrome } = state;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border bg-card">
        {/* Path input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setState({ path: sanitizePath(inputValue) });
          }}
          className="flex items-center gap-2"
        >
          <label
            htmlFor="preview-path"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            Path:
          </label>
          <input
            id="preview-path"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-sm font-mono w-56 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Go
          </button>
        </form>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.path}
              type="button"
              onClick={() => setState({ path: preset.path })}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                path === preset.path
                  ? "bg-primary/20 text-primary border border-primary/50"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* View mode toggle */}
          <div className="flex rounded border border-border overflow-hidden">
            {(["desktop", "both", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setState({ viewMode: mode })}
                className={`px-2 py-1 text-xs capitalize transition-colors ${
                  viewMode === mode
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <select
            value={mobileWidth}
            onChange={(e) => setState({ mobileWidth: Number(e.target.value) })}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
            aria-label="Mobile device width"
          >
            {mobilePresets.map((preset) => (
              <option key={preset.width} value={preset.width}>
                {preset.label} ({preset.width}px)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setState({ hideChrome: !hideChrome })}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              hideChrome
                ? "bg-primary/20 text-primary border border-primary/50"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Hide Chrome
          </button>
        </div>
      </div>

      {/* Viewport(s) */}
      <div className="flex-1 flex gap-3 p-3 bg-background overflow-hidden">
        {/* Desktop viewport */}
        {viewMode !== "mobile" && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-t-lg border border-b-0 border-outline-variant">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Desktop
              </span>
            </div>
            <iframe
              ref={desktopRef}
              key={`desktop-${path}-${hideChrome}`}
              src={path}
              title="Desktop preview"
              className="flex-1 w-full border border-outline-variant rounded-b-lg bg-background"
              onLoad={() => injectStyles(desktopRef.current)}
            />
          </div>
        )}

        {/* Mobile viewport */}
        {viewMode !== "desktop" && (
          <div
            className={`flex flex-col ${viewMode === "mobile" ? "mx-auto" : "shrink-0"}`}
            style={{ width: mobileWidth }}
          >
            <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-t-lg border border-b-0 border-outline-variant">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <span className="text-xs font-medium text-muted-foreground">
                Mobile ({mobileWidth}px)
              </span>
            </div>
            <iframe
              ref={mobileRef}
              key={`mobile-${path}-${hideChrome}`}
              src={path}
              title="Mobile preview"
              className="flex-1 border border-outline-variant rounded-b-lg bg-background"
              style={{ width: mobileWidth }}
              onLoad={() => injectStyles(mobileRef.current)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
