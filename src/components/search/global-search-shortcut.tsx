/**
 * Global Search Shortcut Component
 * Phase 3C: Keyboard shortcut (Cmd/Ctrl+K) for global search
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { UniversalSearchInput } from "./universal-search-input";
import { type SearchResult } from "~/lib/services/search-service";

interface GlobalSearchShortcutProps {
  children?: React.ReactNode;
}

export function GlobalSearchShortcut({ children }: GlobalSearchShortcutProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      
      // Escape to close
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); };
  }, [isOpen]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        const input = document.querySelector('[data-search-input]')!;
        if (input) {
          input.focus();
        }
      }, 100);
      
      return () => { clearTimeout(timer); };
    }
    
    return undefined;
  }, [isOpen]);

  const handleResultSelect = (result: SearchResult) => {
    setIsOpen(false);
    router.push(result.url);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <>
      {/* Trigger element (optional) */}
      {children && (
        <div onClick={() => { setIsOpen(true); }} className="cursor-pointer">
          {children}
        </div>
      )}

      {/* Search Dialog */}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Global Search</DialogTitle>
          </DialogHeader>
          
          <div className="p-4">
            <UniversalSearchInput
              placeholder="Search issues, machines, users, locations..."
              showSuggestions={true}
              showRecentSearches={true}
              maxSuggestions={8}
              autoFocus={true}
              onResultSelect={handleResultSelect}
              className="w-full"
            />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 px-3">
              <div className="flex items-center gap-4">
                <span>🔍 Search across everything</span>
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  ESC
                </kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Search Button Trigger
 * Button that opens global search when clicked
 */
interface SearchButtonTriggerProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  showShortcut?: boolean;
  className?: string;
}

export function SearchButtonTrigger({ 
  variant = "outline",
  size = "sm",
  showShortcut = true,
  className = "" 
}: SearchButtonTriggerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the appropriate shortcut key based on platform
  const shortcutKey = mounted 
    ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
    : 'Ctrl';

  // Variant styles matching shadcn/ui button patterns
  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground", 
    ghost: "hover:bg-accent hover:text-accent-foreground"
  };

  return (
    <GlobalSearchShortcut>
      <button
        className={`
          inline-flex items-center justify-start gap-2 px-3 py-2 text-sm font-medium rounded-md
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          ${variantStyles[variant]}
          ${size === 'sm' ? 'h-8 text-xs' : size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'}
          ${className}
        `}
        type="button"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-muted-foreground truncate">
            Search anything...
          </span>
        </div>
        
        {showShortcut && (
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
            {shortcutKey}K
          </kbd>
        )}
      </button>
    </GlobalSearchShortcut>
  );
}

/**
 * Hook for global search shortcut functionality
 * Can be used in other components to implement search shortcuts
 */
export function useGlobalSearchShortcut() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); };
  }, []);

  return {
    isSearchOpen,
    openSearch: () => { setIsSearchOpen(true); },
    closeSearch: () => { setIsSearchOpen(false); },
  };
}