"use client";

import { Box, Typography, Card, Chip, Alert } from "@mui/material";
import Grid from "@mui/material/Grid";

import DetailedIssueCard from "../dashboard/_components/DetailedIssueCard";

import { api } from "~/trpc/react";

type IssueStatus = "new" | "in progress" | "acknowledged" | "resolved";
type IssuePriority = "high" | "medium" | "low";

export function AuthenticatedDashboard(): React.ReactNode {
  const { data: issues, isLoading, error } = api.issue.core.getAll.useQuery({});

  if (isLoading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          My Dashboard
        </Typography>
        <Typography color="text.secondary">Loading your issues...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          My Dashboard
        </Typography>
        <Alert severity="error">
          Failed to load your issues: {error.message}
        </Alert>
      </Box>
    );
  }

  const openIssues =
    issues
      ?.filter((issue) => issue.status.category !== "RESOLVED")
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        machineName: issue.machine.model.name,
        status: issue.status.name.toLowerCase() as IssueStatus,
        priority: issue.priority.name.toLowerCase() as IssuePriority,
      })) ?? [];

  const resolvedIssues =
    issues
      ?.filter((issue) => issue.status.category === "RESOLVED")
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        machineName: issue.machine.model.name,
        status: issue.status.name.toLowerCase() as IssueStatus,
        priority: issue.priority.name.toLowerCase() as IssuePriority,
      })) ?? [];

  // Mock newly reported data (replace with real data later)
  const newlyReported = [{ location: "Pinballz Arcade", count: 2 }];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
        My Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's what's happening with your issues and assignments.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              My Open Issues
            </Typography>
            {openIssues.length > 0 ? (
              openIssues.map((issue) => (
                <DetailedIssueCard key={issue.id} {...issue} />
              ))
            ) : (
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No open issues assigned to you.
                </Typography>
              </Card>
            )}
          </Box>

          <Box>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              Recently Resolved
            </Typography>
            {resolvedIssues.length > 0 ? (
              resolvedIssues
                .slice(0, 5)
                .map((issue) => <DetailedIssueCard key={issue.id} {...issue} />)
            ) : (
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No recently resolved issues.
                </Typography>
              </Card>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              Newly Reported
            </Typography>
            <Card sx={{ p: 3 }}>
              {newlyReported.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 2,
                  }}
                >
                  <Typography variant="body1" fontWeight="medium">
                    {item.location}
                  </Typography>
                  <Chip
                    label={item.count.toString()}
                    sx={{
                      bgcolor: "primary.main",
                      color: "white",
                      fontWeight: "bold",
                      minWidth: 32,
                    }}
                  />
                </Box>
              ))}
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
