"use client";

import {
  Create as CreateIcon,
  Assignment as AssignIcon,
  SwapVert as StatusIcon,
  Comment as CommentIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { Box, Typography, Paper, Stack, Chip } from "@mui/material";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { type IssueWithDetails } from "~/types/issue";

interface IssueTimelineProps {
  issue: IssueWithDetails;
  user: PinPointSupabaseUser | null;
}

export function IssueTimeline({
  issue,
  user: _user,
}: IssueTimelineProps): React.JSX.Element {
  // Create timeline activities from available issue data
  const activities = [
    {
      id: `created-${issue.id}`,
      type: "created",
      title: "Issue Created",
      description: `Issue "${issue.title}" was created`,
      timestamp: issue.createdAt,
      user: issue.createdBy,
    },
  ];

  // Add assignment activity if assigned
  if (issue.assignedTo) {
    activities.push({
      id: `assigned-${issue.id}`,
      type: "assigned",
      title: "Issue Assigned",
      description: `Issue assigned to ${issue.assignedTo.name ?? "Unknown"}`,
      timestamp: issue.updatedAt,
      user: issue.assignedTo,
    });
  }

  // Add resolved activity if resolved
  if (issue.resolvedAt) {
    activities.push({
      id: `resolved-${issue.id}`,
      type: "resolved",
      title: "Issue Resolved",
      description: "Issue marked as resolved",
      timestamp: issue.resolvedAt,
      user: issue.createdBy,
    });
  }

  // Add comment activities
  issue.comments.forEach((comment) => {
    activities.push({
      id: `comment-${comment.id}`,
      type: "comment",
      title: "Comment Added",
      description: `${comment.author.name ?? "Unknown"} commented: ${comment.content.slice(0, 100)}${comment.content.length > 100 ? "..." : ""}`,
      timestamp: comment.createdAt,
      user: comment.author,
    });
  });

  // Sort activities by timestamp
  activities.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const getActivityIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case "created":
        return <CreateIcon />;
      case "assigned":
        return <AssignIcon />;
      case "status_change":
        return <StatusIcon />;
      case "comment":
        return <CommentIcon />;
      case "edited":
        return <EditIcon />;
      default:
        return <CreateIcon />;
    }
  };

  const getActivityColor = (
    type: string,
  ): "primary" | "secondary" | "default" => {
    switch (type) {
      case "created":
        return "primary";
      case "assigned":
        return "secondary";
      case "comment":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Timeline
      </Typography>

      <Box
        data-testid="issue-timeline"
        role="region"
        aria-label="Issue timeline"
      >
        {activities.map((activity, index) => (
          <Box key={activity.id} sx={{ display: "flex", mb: 2 }}>
            {/* Timeline indicator */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                mr: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  mb: 1,
                }}
              >
                {getActivityIcon(activity.type)}
              </Box>
              {index < activities.length - 1 && (
                <Box
                  sx={{
                    width: 2,
                    flex: 1,
                    bgcolor: "divider",
                    minHeight: 20,
                  }}
                />
              )}
            </Box>

            {/* Timeline content */}
            <Box sx={{ flex: 1 }}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.50" }}>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2">
                      {activity.title}
                    </Typography>
                    <Chip
                      label={activity.type}
                      size="small"
                      color={getActivityColor(activity.type)}
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {activity.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(activity.timestamp).toLocaleString()}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Activity markers for tests */}
      {activities.map((activity) => (
        <Box
          key={`marker-${activity.id}`}
          data-testid={`timeline-${activity.type}`}
          sx={{ display: "none" }}
        />
      ))}
    </Box>
  );
}
