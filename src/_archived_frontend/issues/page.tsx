"use client";

import {
  BugReport,
  LocationOn,
  Games,
  FilterList,
  Search,
  CheckCircle,
  RadioButtonUnchecked,
  Comment,
  CameraAlt,
  SwapVert,
  FiberNew,
} from "@mui/icons-material";
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
  Paper,
  TextField,
  InputAdornment,
  Autocomplete,
} from "@mui/material";
import { IssueStatusCategory } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";

import { UserAvatar } from "~/app/_components/user-avatar";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { api } from "~/trpc/react";

export default function IssuesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [statusCategoryFilter, setStatusCategoryFilter] =
    useState<IssueStatusCategory | null>(null);
  const [sortBy, setSortBy] = useState<
    "created" | "updated" | "status" | "severity" | "game"
  >("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);

  const { isAuthenticated } = useCurrentUser();

  // Get all issues with current filters
  const {
    data: issues,
    isLoading: isLoadingIssues,
    error: issueError,
  } = api.issue.getAll.useQuery({
    locationId: locationFilter || undefined,
    statusId: statusFilter || undefined,
    modelId: gameFilter || undefined,
    statusCategory: statusCategoryFilter ?? undefined,
    sortBy,
    sortOrder,
  });

  // Get status counts
  const { data: statusCounts } = api.issue.getStatusCounts.useQuery();

  // Get locations for filter dropdown
  const { data: locations } = api.location.getAll.useQuery();

  // Get issue statuses for filter dropdown
  const { data: issueStatuses } = api.issueStatus.getAll.useQuery();

  // Get game titles for game filter
  const { data: models } = api.model.getAll.useQuery();

  const handleClearFilters = () => {
    setLocationFilter("");
    setStatusFilter("");
    setGameFilter("");
    setSearchTerm("");
    setStatusCategoryFilter(null);
  };

  const handleSortChange = (newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
  };

  const handleCategoryFilterClick = (category: IssueStatusCategory) => {
    if (statusCategoryFilter === category) {
      setStatusCategoryFilter(null); // Toggle off if already selected
    } else {
      setStatusCategoryFilter(category);
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case "Critical":
        return "#d73a49";
      case "High":
        return "#f66a0a";
      case "Medium":
        return "#0969da";
      case "Low":
        return "#1a7f37";
      default:
        return "#656d76";
    }
  };

  // Filter issues based on search term
  const filteredIssues =
    issues?.filter(
      (issue) =>
        searchTerm === "" ||
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    ) ?? [];

  if (isLoadingIssues) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading issues...
        </Typography>
      </Container>
    );
  }

  if (issueError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading issues: {issueError.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <BugReport sx={{ fontSize: 32, color: "text.secondary" }} />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
              Issues
            </Typography>
          </Box>
          {isAuthenticated && (
            <Button
              variant="contained"
              color="success"
              component={Link}
              href="/location"
              sx={{ fontWeight: 600 }}
            >
              New issue
            </Button>
          )}
        </Box>

        {/* Search and Filters */}
        <Box sx={{ mb: 3 }}>
          {/* Search and Filter Controls Row */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <TextField
              placeholder="Search all issues"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, maxWidth: 400 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Game Filter - Separate and Prominent */}
            <Autocomplete
              options={models ?? []}
              getOptionLabel={(option) => option.name}
              value={models?.find((g) => g.id === gameFilter) ?? null}
              onChange={(_, newValue) => setGameFilter(newValue?.id ?? "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Filter by game"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Games sx={{ color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              sx={{ minWidth: 200 }}
              clearOnEscape
            />

            {/* Sort Controls */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === "created" ||
                      value === "updated" ||
                      value === "status" ||
                      value === "severity" ||
                      value === "game"
                    ) {
                      handleSortChange(value);
                    }
                  }}
                  label="Sort by"
                >
                  <MenuItem value="created">Created</MenuItem>
                  <MenuItem value="updated">Updated</MenuItem>
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="severity">Severity</MenuItem>
                  <MenuItem value="game">Game</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                sx={{ minWidth: "auto", px: 1 }}
              >
                <SwapVert sx={{ fontSize: 18 }} />
              </Button>
            </Box>

            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => setShowFilters(!showFilters)}
              size="small"
            >
              More Filters
            </Button>
          </Box>

          {/* Filter Controls */}
          {showFilters && (
            <Paper sx={{ p: 2, mb: 2, backgroundColor: "grey.50" }}>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    label="Location"
                  >
                    <MenuItem value="">All Locations</MenuItem>
                    {locations?.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    {issueStatuses?.map((status) => (
                      <MenuItem key={status.id} value={status.id}>
                        {status.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button onClick={handleClearFilters} size="small">
                  Clear
                </Button>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Issue Count Tabs */}
        <Box sx={{ display: "flex", gap: 3, mb: 2 }}>
          <Button
            startIcon={<FiberNew />}
            onClick={() => handleCategoryFilterClick(IssueStatusCategory.NEW)}
            color={
              statusCategoryFilter === IssueStatusCategory.NEW
                ? "primary"
                : "inherit"
            }
            sx={{
              fontWeight:
                statusCategoryFilter === IssueStatusCategory.NEW ? 700 : 400,
            }}
          >
            {statusCounts?.NEW ?? 0} New
          </Button>
          <Button
            startIcon={<RadioButtonUnchecked />}
            onClick={() => handleCategoryFilterClick(IssueStatusCategory.OPEN)}
            color={
              statusCategoryFilter === IssueStatusCategory.OPEN
                ? "primary"
                : "inherit"
            }
            sx={{
              fontWeight:
                statusCategoryFilter === IssueStatusCategory.OPEN ? 700 : 400,
            }}
          >
            {statusCounts?.OPEN ?? 0} Open
          </Button>
          <Button
            startIcon={<CheckCircle />}
            onClick={() =>
              handleCategoryFilterClick(IssueStatusCategory.CLOSED)
            }
            color={
              statusCategoryFilter === IssueStatusCategory.CLOSED
                ? "primary"
                : "inherit"
            }
            sx={{
              fontWeight:
                statusCategoryFilter === IssueStatusCategory.CLOSED ? 700 : 400,
            }}
          >
            {statusCounts?.CLOSED ?? 0} Closed
          </Button>
        </Box>
      </Box>

      {/* Issues List */}
      <Paper sx={{ border: "1px solid", borderColor: "divider" }}>
        {filteredIssues.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <BugReport sx={{ fontSize: 60, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No issues found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm || locationFilter || statusFilter
                ? "Try adjusting your search or filters"
                : "No issues have been reported yet"}
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {filteredIssues.map((issue, index) => {
              const isClosed =
                issue.status.category === IssueStatusCategory.CLOSED;

              return (
                <Box key={issue.id}>
                  <ListItem
                    sx={{
                      px: 3,
                      py: 2,
                      "&:hover": {
                        backgroundColor: "grey.50",
                      },
                    }}
                  >
                    <Box sx={{ width: "100%" }}>
                      {/* Main Issue Row */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 2,
                          mb: 1,
                        }}
                      >
                        {/* Status Icon */}
                        <Box sx={{ mt: 0.5 }}>
                          {isClosed ? (
                            <CheckCircle
                              sx={{ fontSize: 16, color: "primary.main" }}
                            />
                          ) : (
                            <RadioButtonUnchecked
                              sx={{ fontSize: 16, color: "success.main" }}
                            />
                          )}
                        </Box>

                        {/* Issue Content */}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          {/* Game Name - Prominent Display */}
                          <Box sx={{ mb: 1 }}>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 700,
                                color: "primary.main",
                                fontSize: "1.1rem",
                                lineHeight: 1.2,
                              }}
                            >
                              {issue.machine.model.name}
                            </Typography>
                          </Box>

                          {/* Issue Number and Title */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              mb: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                flexShrink: 0,
                              }}
                            >
                              #{issue.number}
                            </Typography>
                            <Typography
                              component={Link}
                              href={`/issues/${issue.id}`}
                              variant="body1"
                              sx={{
                                fontWeight: 600,
                                color: "text.primary",
                                textDecoration: "none",
                                flexGrow: 1,
                                "&:hover": {
                                  color: "primary.main",
                                },
                              }}
                            >
                              {issue.title}
                            </Typography>

                            {/* Labels */}
                            <Box
                              sx={{
                                display: "flex",
                                gap: 0.5,
                                flexWrap: "wrap",
                                flexShrink: 0,
                              }}
                            >
                              <Chip
                                label={issue.status.name}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: "0.75rem",
                                  backgroundColor: isClosed
                                    ? "primary.main"
                                    : "success.main",
                                  color: "white",
                                }}
                              />
                              {issue.severity && (
                                <Chip
                                  label={issue.severity}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: "0.75rem",
                                    backgroundColor: getSeverityColor(
                                      issue.severity,
                                    ),
                                    color: "white",
                                  }}
                                />
                              )}
                            </Box>
                          </Box>

                          {/* Description Preview */}
                          {issue.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {issue.description}
                            </Typography>
                          )}

                          {/* Metadata */}
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              flexWrap: "wrap",
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Opened{" "}
                              {new Date(issue.createdAt).toLocaleDateString()}{" "}
                              by{" "}
                              {issue.reporter ? (
                                <Box component="span" sx={{ fontWeight: 600 }}>
                                  {issue.reporter.name ?? "Unknown"}
                                </Box>
                              ) : (
                                <Box
                                  component="span"
                                  sx={{ fontStyle: "italic" }}
                                >
                                  anonymous
                                </Box>
                              )}
                            </Typography>

                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <LocationOn
                                sx={{ fontSize: 14, color: "text.secondary" }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {issue.machine.room.location.name}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Right Side Info */}
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            flexShrink: 0,
                          }}
                        >
                          {/* Assignee */}
                          {issue.assignee && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <UserAvatar user={issue.assignee} size="small" />
                            </Box>
                          )}

                          {/* Comment Count */}
                          {issue._count.comments > 0 && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              <Comment
                                sx={{ fontSize: 14, color: "text.secondary" }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {issue._count.comments}
                              </Typography>
                            </Box>
                          )}

                          {/* Attachment Count */}
                          {issue._count.attachments > 0 && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              <CameraAlt
                                sx={{ fontSize: 14, color: "text.secondary" }}
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {issue._count.attachments}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </ListItem>
                  {index < filteredIssues.length - 1 && (
                    <Divider sx={{ mx: 3 }} />
                  )}
                </Box>
              );
            })}
          </List>
        )}
      </Paper>
    </Container>
  );
}
