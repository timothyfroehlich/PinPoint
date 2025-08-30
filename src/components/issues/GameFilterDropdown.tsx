/**
 * Machine Filter Dropdown Component
 * Filters issues by machine/game with real-time issue counts
 */

import { useMemo } from "react";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";

interface GameFilterDropdownProps {
  onChange: (machineId: string) => void;
  value: string;
  disabled?: boolean;
  showCounts?: boolean;
}

export function GameFilterDropdown({ 
  onChange, 
  value, 
  disabled = false,
  showCounts = true 
}: GameFilterDropdownProps) {
  // Fetch real machine data from API
  const { data: machines, isLoading: machinesLoading } = api.machine.core.getAllForIssues.useQuery();
  
  // Fetch issues for count calculation (optional for performance)
  const { data: issues } = api.issue.core.getAll.useQuery(undefined, {
    enabled: showCounts, // Only fetch if we want to show counts
  });
  
  // Calculate issue counts per machine
  const machineIssueCounts = useMemo(() => {
    if (!issues || !showCounts) return {};
    
    const counts: Record<string, number> = {};
    issues.forEach((issue: any) => {
      if (issue.machine?.id) {
        counts[issue.machine.id] = (counts[issue.machine.id] || 0) + 1;
      }
    });
    
    return counts;
  }, [issues, showCounts]);
  
  if (machinesLoading) {
    return (
      <div className="space-y-1 min-w-[150px]">
        <Label className="text-xs font-medium">Machine</Label>
        <div className="flex items-center justify-center h-9 px-3 border rounded-md">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  
  if (!machines) {
    return (
      <div className="space-y-1 min-w-[150px]">
        <Label className="text-xs font-medium">Machine</Label>
        <div className="flex items-center justify-center h-9 px-3 border rounded-md text-muted-foreground">
          No machines
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 min-w-[150px]">
      <Label htmlFor="machine-filter" className="text-xs font-medium">
        Machine
      </Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="All Machines" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Machines</SelectItem>
          {machines.map((machine) => {
            const issueCount = machineIssueCounts[machine.id] || 0;
            return (
              <SelectItem key={machine.id} value={machine.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{machine.name}</span>
                  {showCounts && (
                    <Badge 
                      variant={issueCount > 0 ? "default" : "secondary"} 
                      className="ml-2 h-5 px-1.5 text-xs"
                    >
                      {issueCount}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}