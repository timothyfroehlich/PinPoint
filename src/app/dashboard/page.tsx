"use client";

import { Box, Typography, Card, Chip } from "@mui/material";
import Grid from "@mui/material/Grid";

import DetailedIssueCard from "./_components/DetailedIssueCard";

import type { JSX } from "react";

type IssueStatus = "new" | "in progress" | "acknowledged" | "resolved";
type IssuePriority = "high" | "medium" | "low";

interface Issue {
  title: string;
  machineName: string;
  status: IssueStatus;
  priority: IssuePriority;
}

const openIssues: Issue[] = [
  {
    title: "Left flipper is weak",
    machineName: "Twilight Zone",
    status: "in progress",
    priority: "high",
  },
  {
    title: "Sound cutting out",
    machineName: "The Addams Family",
    status: "acknowledged",
    priority: "medium",
  },
];

const resolvedIssues: Issue[] = [
  {
    title: "GI lights out in backbox",
    machineName: "The Addams Family",
    status: "resolved",
    priority: "low",
  },
];

const newlyReported = [{ location: "Pinballz Arcade", count: 2 }];

export default function DashboardPage(): JSX.Element {
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
              openIssues.map((issue, index) => (
                <DetailedIssueCard key={index} {...issue} />
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
              resolvedIssues.map((issue, index) => (
                <DetailedIssueCard key={index} {...issue} />
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
