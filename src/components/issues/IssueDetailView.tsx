"use client";

import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Button,
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
}: IssueDetailViewProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [error, setError] = useState<string | null>(null);

  // Use tRPC query to get real-time updates
  const {
    data: issue,
    error: queryError,
    refetch,
  } = api.issue.core.getById.useQuery({ id: issueId });

  const hasPermission = (permission: string): boolean => {
    if (!session?.user) return false;
    const userWithPermissions = session.user as { permissions?: string[] };
    return userWithPermissions.permissions?.includes(permission) ?? false;
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
        <Button
          variant="contained"
          onClick={() => {
            void refetch();
          }}
          data-testid="retry-button"
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Container>
    );
  }

  // Use the data from query if available, fallback to initial data
  const currentIssue = issue ?? initialIssue;

  const layoutProps = {
    "data-testid": isMobile ? "mobile-layout" : "desktop-layout",
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }} {...layoutProps}>
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => {
            setError(null);
          }}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <IssueDetail
              issue={currentIssue}
              session={session}
              hasPermission={hasPermission}
            />
          </Paper>

          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <IssueComments
              issue={currentIssue}
              session={session}
              hasPermission={hasPermission}
              onError={setError}
            />
          </Paper>

          {isAuthenticated && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <IssueTimeline issue={currentIssue} session={session} />
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
                  issue={currentIssue}
                  session={session}
                  hasPermission={hasPermission}
                  onError={setError}
                />
              </Paper>
            )}

            {/* Actions */}
            <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
              <IssueActions
                issue={currentIssue}
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
                  {new Date(currentIssue.createdAt).toLocaleDateString()}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1" data-testid="issue-last-updated">
                  {new Date(currentIssue.updatedAt).toLocaleDateString()}
                </Typography>
              </Box>

              {currentIssue.assignedTo && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Assigned To
                  </Typography>
                  <Typography variant="body1" data-testid="assigned-to">
                    {currentIssue.assignedTo.name}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1" data-testid="issue-created-by">
                  {currentIssue.createdBy.name}
                </Typography>
              </Box>
            </Paper>
          </div>
        </Grid>
      </Grid>
    </Container>
  );
}
