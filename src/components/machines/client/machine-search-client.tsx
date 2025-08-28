/**
 * Machine Search Client Island
 * Phase 3B: Debounced search with URL parameter updates
 * Client Component for immediate user feedback and search functionality
 */

"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { SearchIcon, XIcon } from "lucide-react";
import { useDebounce } from "~/lib/hooks/use-debounce";

interface MachineSearchClientProps {
  initialSearch?: string | undefined;
}

export function MachineSearchClient({
  initialSearch = "",
}: MachineSearchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }

    // Reset to first page when search changes
    params.delete("page");

    startTransition(() => {
      router.push(`/machines?${params.toString()}`);
    });
  }, [debouncedSearch, router, searchParams]);

  const clearSearch = () => {
    setSearch("");
  };

  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search machines, locations, or models..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
        className="pl-10 pr-10"
        disabled={isPending}
      />
      {search && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSearch}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
