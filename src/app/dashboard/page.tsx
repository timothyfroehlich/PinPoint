"use client";

import {
  Box,
  Typography,
  Card,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import DetailedIssueCard from "./_components/DetailedIssueCard";

import type { JSX } from "react";

import { api } from "~/trpc/react";

type IssueStatus = "new" | "in progress" | "acknowledged" | "resolved";
type IssuePriority = "high" | "medium" | "low";

const newlyReported = [{ location: "Pinballz Arcade", count: 2 }];

export default function DashboardPage(): JSX.Element {
  const { data: issues, isLoading, error } = api.issue.core.getAll.useQuery({});

  if (isLoading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
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

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's what's happening for your selected collections.
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
              <Typography color="text.secondary">
                No open issues assigned to you.
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              Recently Resolved
            </Typography>
            {resolvedIssues.length > 0 ? (
              resolvedIssues.map((issue) => (
                <DetailedIssueCard key={issue.id} {...issue} />
              ))
            ) : (
              <Typography color="text.secondary">
                No recently resolved issues.
              </Typography>
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
                    label={item.count}
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
