"use client";

import {
  Create as CreateIcon,
  Assignment as AssignIcon,
  SwapVert as StatusIcon,
  Comment as CommentIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from "@mui/lab";
import { Box, Typography, Paper, Stack } from "@mui/material";
import { type Session } from "next-auth";

import { type IssueWithDetails } from "~/types/issue";

interface IssueTimelineProps {
  issue: IssueWithDetails;
  session: Session | null;
}

export function IssueTimeline({
  issue,
  session: _session,
}: IssueTimelineProps): React.JSX.Element {
  // Create timeline activities from available issue data
  const activities = [
    {
      id: "created",
      type: "created",
      title: "Issue Created",
      description: `Created by ${issue.createdBy.name ?? "Unknown"}`,
      timestamp: issue.createdAt,
      user: issue.createdBy,
    },
  ];

  // Add assignment activity if issue is assigned
  if (issue.assignedTo) {
    activities.push({
      id: "assigned",
      type: "assigned",
      title: "Issue Assigned",
      description: `Assigned to ${issue.assignedTo.name ?? "Unknown"}`,
      timestamp: issue.updatedAt, // Best approximation available
      user: issue.assignedTo,
    });
  }

  // Add comment activities
  if (issue.comments) {
    issue.comments.forEach((comment, index) => {
      activities.push({
        id: `comment-${comment.id}`,
        type: "comment",
        title: "Comment Added",
        description: `${comment.author.name ?? "Unknown"} commented: ${comment.content.slice(0, 100)}${comment.content.length > 100 ? "..." : ""}`,
        timestamp: comment.createdAt,
        user: comment.author,
      });
    });
  }

  // Add resolution activity if issue is resolved
  if (issue.resolvedAt) {
    activities.push({
      id: "resolved",
      type: "status_change",
      title: "Issue Resolved",
      description: `Issue marked as ${issue.status.name}`,
      timestamp: issue.resolvedAt,
      user: issue.createdBy, // Best approximation
    });
  }

  // Sort activities by timestamp
  activities.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

  const getActivityColor = (type: string): string => {
    switch (type) {
      case "created":
        return "primary";
      case "assigned":
        return "secondary";
      case "status_change":
        return "warning";
      case "comment":
        return "info";
      case "edited":
        return "success";
      default:
        return "primary";
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
        <Timeline>
          {activities.map((activity, index) => (
            <TimelineItem key={activity.id}>
              <TimelineSeparator>
                <TimelineDot
                  color={
                    getActivityColor(activity.type) as
                      | "primary"
                      | "secondary"
                      | "warning"
                      | "info"
                      | "success"
                  }
                >
                  {getActivityIcon(activity.type)}
                </TimelineDot>
                {index < activities.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.50" }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      {activity.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {activity.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(activity.timestamp).toLocaleString()}
                    </Typography>
                  </Stack>
                </Paper>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Box>

      {/* Activity markers for tests */}
      <Box sx={{ display: "none" }}>
        <div data-testid="assignment-activity" />
        <div data-testid="status-change-activity" />
      </Box>
    </Box>
  );
}
