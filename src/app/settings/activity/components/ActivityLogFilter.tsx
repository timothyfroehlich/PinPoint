/**
 * Activity Log Filter Client Island
 * Phase 4B.4: Activity log filtering functionality
 */

"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { CalendarIcon, FilterIcon, XIcon, SearchIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "~/lib/utils";

export function ActivityLogFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current filter values from URL
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    searchParams.get("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : undefined,
  );
  const [dateTo, setDateeTo] = useState<Date | undefined>(
    searchParams.get("dateTo")
      ? new Date(searchParams.get("dateTo")!)
      : undefined,
  );
  const [selectedUser, setSelectedUser] = useState(
    searchParams.get("userId") ?? "",
  );
  const [selectedAction, setSelectedAction] = useState(
    searchParams.get("action") ?? "",
  );
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") ?? "",
  );

  // Create query string from current filters
  const createQueryString = useCallback(
    (params: Record<string, string | undefined>) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newSearchParams.set(key, value);
        } else {
          newSearchParams.delete(key);
        }
      });

      return newSearchParams.toString();
    },
    [searchParams],
  );

  const applyFilters = () => {
    const queryString = createQueryString({
      dateFrom: dateFrom?.toISOString().split("T")[0],
      dateTo: dateTo?.toISOString().split("T")[0],
      userId: selectedUser,
      action: selectedAction,
      search: searchTerm,
      page: "1", // Reset to first page when filtering
    });

    router.push(`?${queryString}`);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateeTo(undefined);
    setSelectedUser("");
    setSelectedAction("");
    setSearchTerm("");
    router.push(window.location.pathname);
  };

  const setQuickDateRange = (days: number) => {
    const to = new Date();
    const from = subDays(to, days);
    setDateFrom(from);
    setDateeTo(to);
  };

  const hasActiveFilters =
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(selectedUser) ||
    Boolean(selectedAction) ||
    Boolean(searchTerm);

  return (
    <div className="space-y-4">
      {/* Quick Date Ranges */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuickDateRange(1);
          }}
        >
          Last 24h
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuickDateRange(7);
          }}
        >
          Last 7 days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuickDateRange(30);
          }}
        >
          Last 30 days
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setQuickDateRange(90);
          }}
        >
          Last 90 days
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Date From */}
        <div className="space-y-2">
          <Label>From Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label>To Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateTo && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateeTo}
                initialFocus
                disabled={(date) => (dateFrom ? date < dateFrom : false)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* User Filter */}
        <div className="space-y-2">
          <Label>User</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All users</SelectItem>
              <SelectItem value="user-123">John Doe</SelectItem>
              <SelectItem value="user-admin">Admin User</SelectItem>
              <SelectItem value="user-456">Jane Smith</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Filter */}
        <div className="space-y-2">
          <Label>Action Type</Label>
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger>
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All actions</SelectItem>
              <SelectItem value="USER_LOGIN">User Login</SelectItem>
              <SelectItem value="USER_LOGOUT">User Logout</SelectItem>
              <SelectItem value="ISSUE_CREATED">Issue Created</SelectItem>
              <SelectItem value="ISSUE_UPDATED">Issue Updated</SelectItem>
              <SelectItem value="ROLE_CHANGED">Role Changed</SelectItem>
              <SelectItem value="SETTINGS_UPDATED">Settings Updated</SelectItem>
              <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label>Search Details</Label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search in activity details, IP addresses, or user agents..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <Button onClick={applyFilters}>
            <FilterIcon className="mr-2 h-4 w-4" />
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              <XIcon className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            {
              [
                dateFrom && `From: ${format(dateFrom, "MMM d")}`,
                dateTo && `To: ${format(dateTo, "MMM d")}`,
                selectedUser && `User filtered`,
                selectedAction && `Action filtered`,
                searchTerm && `Search active`,
              ].filter(Boolean).length
            }{" "}
            filter
            {[
              dateFrom && `From: ${format(dateFrom, "MMM d")}`,
              dateTo && `To: ${format(dateTo, "MMM d")}`,
              selectedUser && `User filtered`,
              selectedAction && `Action filtered`,
              searchTerm && `Search active`,
            ].filter(Boolean).length !== 1
              ? "s"
              : ""}{" "}
            active
          </div>
        )}
      </div>
    </div>
  );
}
