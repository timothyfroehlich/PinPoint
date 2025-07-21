"use client";

import { Box, Typography, Chip, Stack, Card, CardContent } from "@mui/material";
import { type Session } from "next-auth";

import { type IssueWithDetails } from "~/types/issue";

interface IssueDetailProps {
  issue: IssueWithDetails;
  session: Session | null;
  hasPermission: (permission: string) => boolean;
}

export function IssueDetail({ issue, session }: IssueDetailProps): JSX.Element {
  const isAuthenticated = !!session?.user;

  return (
    <Box>
      {/* Issue Title */}
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        data-testid="issue-title"
      >
        {issue.title}
      </Typography>

      {/* Status and Priority */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
        <Chip
          label={issue.status.name}
          color="primary"
          variant="outlined"
          data-testid="issue-status"
          sx={{
            backgroundColor: (issue.status.color ?? "#000") + "20",
            borderColor: issue.status.color ?? "#000",
            color: issue.status.color ?? "#000",
          }}
        />

        {issue.priority.color && (
          <Chip
            label={issue.priority.name}
            color="secondary"
            variant="outlined"
            data-testid="issue-priority"
            sx={{
              backgroundColor: (issue.priority.color ?? "#000") + "20",
              borderColor: issue.priority.color ?? "#000",
              color: issue.priority.color ?? "#000",
            }}
          />
        )}
      </Stack>

      {/* Description */}
      {issue.description && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Description
          </Typography>
          <Typography
            variant="body1"
            data-testid="issue-description"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {issue.description}
          </Typography>
        </Box>
      )}

      {/* Machine Information */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Machine Information
          </Typography>

          <Box data-testid="machine-info">
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Game
              </Typography>
              <Typography variant="body1" data-testid="machine-name">
                {issue.machine.model.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                by {issue.machine.model.manufacturer}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Location
              </Typography>
              <Typography variant="body1" data-testid="machine-location">
                {issue.machine.location.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {issue.machine.location.address}
              </Typography>
            </Box>

            {issue.machine.serialNumber && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Serial Number
                </Typography>
                <Typography variant="body1" data-testid="machine-serial">
                  {issue.machine.serialNumber}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Show assignee info for authenticated users */}
      {isAuthenticated && (
        <Box data-testid="issue-assignee">
          <Typography variant="h6" gutterBottom>
            Assignment
          </Typography>
          {issue.assignedTo ? (
            <Typography variant="body1">
              Assigned to {issue.assignedTo.name}
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Unassigned
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
