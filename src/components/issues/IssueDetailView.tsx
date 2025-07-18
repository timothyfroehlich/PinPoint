"use client";

import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Skeleton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { type Session } from "next-auth";
import { useState } from "react";

import { IssueActions } from "./IssueActions";
import { IssueComments } from "./IssueComments";
import { IssueDetail } from "./IssueDetail";
import { IssueStatusControl } from "./IssueStatusControl";
import { IssueTimeline } from "./IssueTimeline";

import { api } from "~/trpc/react";
import { type IssueWithDetails } from "~/types/issue";

interface IssueDetailViewProps {
  issue: IssueWithDetails;
  session: Session | null;
  issueId: string;
}

export function IssueDetailView({
  issue: initialIssue,
  session,
  issueId,
}: IssueDetailViewProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [error, setError] = useState<string | null>(null);

  // Use tRPC query to get real-time updates
  const {
    data: issue,
    isLoading,
    error: queryError,
  } = api.issue.core.getById.useQuery(
    { id: issueId },
    {
      initialData: initialIssue,
      refetchOnWindowFocus: false,
    },
  );

  const hasPermission = (permission: string): boolean => {
    if (!session?.user?.permissions) return false;
    return session.user.permissions.includes(permission);
  };

  const isAuthenticated = !!session?.user;

  if (queryError) {
    if (queryError.message.includes("UNAUTHORIZED")) {
      return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert
            severity="error"
            data-testid="permission-denied"
            sx={{ mb: 2 }}
          >
            You do not have permission to view this issue
          </Alert>
        </Container>
      );
    }

    if (queryError.message.includes("not found")) {
      return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error" data-testid="issue-not-found" sx={{ mb: 2 }}>
            Issue not found
          </Alert>
        </Container>
      );
    }

    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" data-testid="network-error" sx={{ mb: 2 }}>
          Failed to load issue. Please try again.
        </Alert>
      </Container>
    );
  }

  if (isLoading || !issue) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <div data-testid="issue-skeleton">
          <Skeleton variant="text" width="60%" height={60} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={200}
            sx={{ mt: 2 }}
          />
        </div>
        <div data-testid="comments-skeleton">
          <Skeleton variant="text" width="40%" height={40} sx={{ mt: 4 }} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={150}
            sx={{ mt: 2 }}
          />
        </div>
        <div data-testid="timeline-skeleton">
          <Skeleton variant="text" width="30%" height={40} sx={{ mt: 4 }} />
          <Skeleton
            variant="rectangular"
            width="100%"
            height={100}
            sx={{ mt: 2 }}
          />
        </div>
      </Container>
    );
  }

  const layoutProps = {
    "data-testid": isMobile ? "mobile-layout" : "desktop-layout",
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} {...layoutProps}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <IssueDetail
              issue={issue}
              session={session}
              hasPermission={hasPermission}
            />
          </Paper>

          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <IssueComments
              issue={issue}
              session={session}
              hasPermission={hasPermission}
              onError={setError}
            />
          </Paper>

          {isAuthenticated && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <IssueTimeline issue={issue} session={session} />
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <div
            data-testid={isMobile ? "mobile-actions-menu" : "desktop-sidebar"}
          >
            {/* Status Control */}
            {isAuthenticated && hasPermission("issues:edit") && (
              <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                <IssueStatusControl
                  issue={issue}
                  session={session}
                  hasPermission={hasPermission}
                  onError={setError}
                />
              </Paper>
            )}

            {/* Actions */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <IssueActions
                issue={issue}
                session={session}
                hasPermission={hasPermission}
                onError={setError}
              />
            </Paper>

            {/* Issue Metadata */}
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Issue Information
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1" data-testid="issue-created-date">
                  {new Date(issue.createdAt).toLocaleDateString()}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1" data-testid="issue-last-updated">
                  {new Date(issue.updatedAt).toLocaleDateString()}
                </Typography>
              </Box>

              {issue.assignedTo && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Assigned To
                  </Typography>
                  <Typography variant="body1" data-testid="assigned-to">
                    {issue.assignedTo.name}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1" data-testid="issue-created-by">
                  {issue.createdBy.name}
                </Typography>
              </Box>
            </Paper>
          </div>
        </Grid>
      </Grid>
    </Container>
  );
}
