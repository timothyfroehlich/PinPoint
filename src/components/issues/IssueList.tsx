"use client";

import {
  ViewList,
  ViewModule,
  Refresh,
  Assignment,
  Close,
} from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Toolbar,
  Checkbox,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ActiveFilters } from "./ActiveFilters";
import { FilterToolbar } from "./FilterToolbar";

import { PermissionGate } from "~/components/permissions/PermissionGate";
import { usePermissions } from "~/hooks/usePermissions";
import { api } from "~/trpc/react";

// Helper function to get status color based on category
const getStatusColor = (
  category: "NEW" | "IN_PROGRESS" | "RESOLVED",
): string => {
  switch (category) {
    case "NEW":
      return "#f44336"; // Red
    case "IN_PROGRESS":
      return "#ff9800"; // Orange
    case "RESOLVED":
      return "#4caf50"; // Green
    default:
      return "#757575"; // Gray
  }
};

interface IssueFilters {
  locationId?: string | undefined;
  machineId?: string | undefined;
  statusIds?: string[] | undefined;
  search?: string | undefined;
  assigneeId?: string | undefined;
  reporterId?: string | undefined;
  ownerId?: string | undefined;
  sortBy: "created" | "updated" | "status" | "severity" | "game";
  sortOrder: "asc" | "desc";
}

// Type for issue data from tRPC (matches actual API response)
interface IssueData {
  id: string;
  title: string;
  status: {
    id: string;
    name: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
    organizationId: string;
    isDefault: boolean;
  };
  priority: {
    id: string;
    name: string;
    order: number;
    organizationId: string;
    isDefault: boolean;
  } | null;
  machine: {
    id: string;
    name: string;
    model: {
      id: string;
      name: string;
      manufacturer: string | null;
      year: number | null;
    };
    location: {
      id: string;
      name: string;
      organizationId: string;
    };
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  createdAt: string | Date;
  _count: {
    comments: number;
    attachments: number;
  };
}

interface IssueListProps {
  initialFilters: IssueFilters;
}

export function IssueList({
  initialFilters,
}: IssueListProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  const [filters, setFilters] = useState<IssueFilters>(initialFilters);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Fetch issues using tRPC
  const {
    data: issues,
    isLoading,
    isError,
    error,
    refetch,
  } = api.issue.core.getAll.useQuery(filters);

  // Update URL when filters change
  const updateFilters = (newFilters: Partial<IssueFilters>): void => {
    const updated: IssueFilters = { ...filters };

    // Handle each filter property explicitly for TypeScript strictest
    if ("locationId" in newFilters) {
      updated.locationId = newFilters.locationId;
    }
    if ("machineId" in newFilters) {
      updated.machineId = newFilters.machineId;
    }
    if ("statusIds" in newFilters) {
      updated.statusIds = newFilters.statusIds;
    }
    if ("search" in newFilters) {
      updated.search = newFilters.search;
    }
    if ("assigneeId" in newFilters) {
      updated.assigneeId = newFilters.assigneeId;
    }
    if ("reporterId" in newFilters) {
      updated.reporterId = newFilters.reporterId;
    }
    if ("ownerId" in newFilters) {
      updated.ownerId = newFilters.ownerId;
    }
    if ("sortBy" in newFilters) {
      updated.sortBy = newFilters.sortBy;
    }
    if ("sortOrder" in newFilters) {
      updated.sortOrder = newFilters.sortOrder;
    }

    setFilters(updated);

    // Update URL for shareable links
    const params = new URLSearchParams(searchParams);

    Object.entries(updated).forEach(([key, value]) => {
      if (value != null && value !== "") {
        if (Array.isArray(value)) {
          // Handle array parameters (like statusIds)
          params.delete(key); // Clear existing values
          if (value.length > 0) {
            value.forEach((item) => {
              params.append(key, String(item));
            });
          }
        } else {
          params.set(key, String(value));
        }
      } else {
        params.delete(key);
      }
    });

    router.push(`/issues?${params.toString()}`);
  };

  // Handle issue selection
  const handleSelectIssue = (issueId: string, selected: boolean): void => {
    setSelectedIssues((prev) =>
      selected ? [...prev, issueId] : prev.filter((id) => id !== issueId),
    );
  };

  const handleSelectAll = (selected: boolean): void => {
    setSelectedIssues(selected ? (issues?.map((issue) => issue.id) ?? []) : []);
  };

  // Note: Bulk actions to be implemented later

  if (permissionsLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load issues: {error.message}
        <Button onClick={() => void refetch()} sx={{ ml: 2 }}>
          <Refresh /> Retry
        </Button>
      </Alert>
    );
  }

  // Handle clear all filters
  const handleClearAllFilters = (): void => {
    setFilters({
      sortBy: "created",
      sortOrder: "desc",
    });
    router.push("/issues");
  };

  return (
    <Box>
      {/* New Filter Toolbar */}
      <FilterToolbar
        filters={filters}
        onFiltersChange={updateFilters}
        isLoading={isLoading}
      />

      {/* Active Filters */}
      <ActiveFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onClearAll={handleClearAllFilters}
      />

      {/* Bulk Actions Toolbar */}
      {selectedIssues.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flex: 1 }}>
              {selectedIssues.length} issue
              {selectedIssues.length > 1 ? "s" : ""} selected
            </Typography>

            <PermissionGate
              permission="issue:assign"
              hasPermission={hasPermission}
              fallback={
                <Tooltip title="Requires issue:assign permission">
                  <span>
                    <Button disabled startIcon={<Assignment />}>
                      Assign
                    </Button>
                  </span>
                </Tooltip>
              }
              showFallback
            >
              <Button
                startIcon={<Assignment />}
                data-testid="bulk-assign-button"
                onClick={() => {
                  // TODO: Implement bulk assign dialog
                  console.log("Bulk assign", selectedIssues);
                }}
              >
                Assign
              </Button>
            </PermissionGate>

            <PermissionGate
              permission="issue:edit"
              hasPermission={hasPermission}
              fallback={
                <Tooltip title="Requires issue:edit permission">
                  <span>
                    <Button disabled sx={{ ml: 1 }} startIcon={<Close />}>
                      Close
                    </Button>
                  </span>
                </Tooltip>
              }
              showFallback
            >
              <Button
                sx={{ ml: 1 }}
                startIcon={<Close />}
                data-testid="bulk-close-button"
                onClick={() => {
                  // TODO: Implement bulk close
                  console.log("Bulk close", selectedIssues);
                }}
              >
                Close
              </Button>
            </PermissionGate>
          </Toolbar>
        </Card>
      )}

      {/* View Mode Controls */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6">
          {issues ? issues.length : 0} issue
          {issues && issues.length !== 1 ? "s" : ""} found
        </Typography>

        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            onClick={() => {
              setViewMode("grid");
            }}
            color={viewMode === "grid" ? "primary" : "default"}
            aria-label="Grid view"
          >
            <ViewModule />
          </IconButton>
          <IconButton
            onClick={() => {
              setViewMode("list");
            }}
            color={viewMode === "list" ? "primary" : "default"}
            aria-label="List view"
          >
            <ViewList />
          </IconButton>
          <Button onClick={() => void refetch()} startIcon={<Refresh />}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Issues List */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress data-testid="main-loading-indicator" />
        </Box>
      ) : !issues || issues.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" textAlign="center">
              No issues found
            </Typography>
            <Typography color="text.secondary" textAlign="center">
              Try adjusting your filters or create a new issue.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {/* Select All Checkbox */}
          <Grid size={{ xs: 12 }}>
            <PermissionGate
              permission="issue:assign"
              hasPermission={hasPermission}
            >
              <Checkbox
                checked={selectedIssues.length === issues.length}
                indeterminate={
                  selectedIssues.length > 0 &&
                  selectedIssues.length < issues.length
                }
                onChange={(e) => {
                  handleSelectAll(e.target.checked);
                }}
              />
              <Typography component="span" sx={{ ml: 1 }}>
                Select All
              </Typography>
            </PermissionGate>
          </Grid>

          {/* Issue Cards */}
          {issues.map((issue: IssueData) => (
            <Grid
              key={issue.id}
              size={{
                xs: 12,
                md: viewMode === "grid" ? 6 : 12,
                lg: viewMode === "grid" ? 4 : 12,
              }}
            >
              <Card
                sx={{
                  border: selectedIssues.includes(issue.id) ? 2 : 0,
                  borderColor: "primary.main",
                  overflow: "visible", // Fix clipping issues
                }}
              >
                <CardContent
                  sx={{
                    p: viewMode === "list" ? 2 : 3, // Reduce padding for list view
                    "&:last-child": { pb: viewMode === "list" ? 2 : 3 },
                  }}
                >
                  <Box
                    display="flex"
                    alignItems={viewMode === "list" ? "center" : "flex-start"}
                    gap={2}
                  >
                    {/* Selection Checkbox */}
                    <PermissionGate
                      permission="issue:assign"
                      hasPermission={hasPermission}
                    >
                      <Box display="flex" alignItems="center">
                        <Checkbox
                          checked={selectedIssues.includes(issue.id)}
                          onChange={(e) => {
                            // Prevent event propagation to parent elements
                            e.stopPropagation();
                            handleSelectIssue(issue.id, e.target.checked);
                          }}
                          onClick={(e) => {
                            // Prevent click from bubbling up and triggering card/navigation clicks
                            e.stopPropagation();
                          }}
                          sx={{ p: 0.5 }} // Reduce checkbox padding
                        />
                      </Box>
                    </PermissionGate>

                    <Box flex={1} minWidth={0}>
                      {" "}
                      {/* minWidth prevents flex shrinking */}
                      {/* Title and Status */}
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        mb={viewMode === "list" ? 0.5 : 1}
                        gap={2}
                      >
                        <Typography
                          variant={viewMode === "list" ? "subtitle1" : "h6"}
                          component="h3"
                          sx={{
                            cursor: "pointer",
                            "&:hover": {
                              textDecoration: "underline",
                              color: "primary.main",
                            },
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                          onClick={(e) => {
                            // Prevent event propagation to parent elements
                            e.stopPropagation();
                            console.log(
                              `[DEBUG] Navigating to issue ${issue.id}: ${issue.title}`,
                            );
                            router.push(`/issues/${issue.id}`);
                          }}
                        >
                          {issue.title}
                        </Typography>
                        <Chip
                          label={issue.status.name}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(
                              issue.status.category,
                            ),
                            color: "white",
                            flexShrink: 0, // Prevent chip from shrinking
                          }}
                        />
                      </Box>
                      {/* Machine and Location */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        mb={viewMode === "list" ? 0.5 : 1}
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {issue.machine.model.name} at{" "}
                        {issue.machine.location.name}
                      </Typography>
                      {/* Priority and Comments/Attachments - Show in grid view or as inline in list */}
                      {viewMode === "grid" ? (
                        <Box
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          mb={2}
                          gap={1}
                        >
                          <Chip
                            label={issue.priority?.name ?? "Normal"}
                            size="small"
                            variant="outlined"
                            sx={{ flexShrink: 0 }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ textAlign: "right" }}
                          >
                            {issue._count.comments} comments •{" "}
                            {issue._count.attachments} attachments
                          </Typography>
                        </Box>
                      ) : (
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={2}
                          mb={0.5}
                        >
                          <Chip
                            label={issue.priority?.name ?? "Normal"}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {issue._count.comments} comments •{" "}
                            {issue._count.attachments} attachments
                          </Typography>
                        </Box>
                      )}
                      {/* Assignee and Created Date */}
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                      >
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          minWidth={0}
                        >
                          {issue.assignedTo ? (
                            <>
                              <Avatar
                                {...(issue.assignedTo.image
                                  ? { src: issue.assignedTo.image }
                                  : {})}
                                sx={{ width: 20, height: 20 }}
                              >
                                {issue.assignedTo.name?.[0]}
                              </Avatar>
                              <Typography
                                variant="caption"
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {issue.assignedTo.name}
                              </Typography>
                            </>
                          ) : (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Unassigned
                            </Typography>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ flexShrink: 0 }}
                        >
                          {new Date(issue.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
