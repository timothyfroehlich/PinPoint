"use client";

import { ChevronDown, Filter } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

import { api } from "~/trpc/react";

interface AdvancedFiltersDropdownProps {
  assigneeId: string;
  reporterId: string;
  ownerId: string;
  onAssigneeChange: (assigneeId: string) => void;
  onReporterChange: (reporterId: string) => void;
  onOwnerChange: (ownerId: string) => void;
}

export function AdvancedFiltersDropdown({
  assigneeId,
  reporterId,
  ownerId,
  onAssigneeChange,
  onReporterChange,
  onOwnerChange,
}: AdvancedFiltersDropdownProps) {
  const [open, setOpen] = useState(false);

  const { data: users, isLoading } = api.user.getAllInOrganization.useQuery();

  // Show active filter count
  const activeFilters = [assigneeId, reporterId, ownerId].filter(
    (filter) => filter !== "",
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "min-w-[120px] justify-between",
            activeFilters > 0 && "border-primary text-primary"
          )}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFilters > 0 && (
              <Badge variant="default" className="h-4 w-4 p-0 text-[10px] min-w-[16px]">
                {activeFilters}
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">
            Advanced Filters
          </h4>

          <div className="space-y-2">
            <Label htmlFor="assignee-filter" className="text-xs font-medium">
              Assignee
            </Label>
            <Select
              value={assigneeId}
              onValueChange={onAssigneeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Any Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="italic text-muted-foreground">Any Assignee</span>
                </SelectItem>
                <SelectItem value="unassigned">
                  <span className="italic text-muted-foreground">Unassigned</span>
                </SelectItem>
                {users && users.length > 0 && (
                  <>
                    <Separator className="my-1" />
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name ?? "Unknown User"}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reporter-filter" className="text-xs font-medium">
              Reporter
            </Label>
            <Select
              value={reporterId}
              onValueChange={onReporterChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Any Reporter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="italic text-muted-foreground">Any Reporter</span>
                </SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? "Unknown User"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-filter" className="text-xs font-medium">
              Machine Owner
            </Label>
            <Select
              value={ownerId}
              onValueChange={onOwnerChange}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Any Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="italic text-muted-foreground">Any Owner</span>
                </SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name ?? "Unknown User"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
