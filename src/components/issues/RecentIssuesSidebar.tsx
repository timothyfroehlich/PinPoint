"use client";

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
} from "@mui/material";
import { type Session } from "next-auth";
import * as React from "react";

import { api } from "~/trpc/react";

interface RecentIssuesSidebarProps {
  selectedMachineId: string | null;
  session: Session | null;
}

export function RecentIssuesSidebar({
  selectedMachineId,
  session: _session,
}: RecentIssuesSidebarProps): React.JSX.Element {
  // Fetch recent issues for the selected machine
  const { data: recentIssues } = api.issue.core.getAll.useQuery(
    {
      machineId: selectedMachineId ?? undefined,
      sortBy: "created",
      sortOrder: "desc",
    },
    {
      enabled: !!selectedMachineId,
    },
  );

  const { data: machineData } = api.machine.core.getById.useQuery(
    { id: selectedMachineId ?? "" },
    {
      enabled: !!selectedMachineId,
    },
  );

  if (!selectedMachineId) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Recent Issues
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a machine to view recent issues
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Recent Issues Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Recent Issues
          </Typography>
          {machineData && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {machineData.name || machineData.model.name}
            </Typography>
          )}

          {recentIssues && recentIssues.length > 0 ? (
            <>
              <List disablePadding>
                {recentIssues.slice(0, 5).map((issue, index) => (
                  <React.Fragment key={issue.id}>
                    {index > 0 && <Divider />}
                    <ListItem disablePadding sx={{ py: 1 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium">
                            {issue.title}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Box
                              sx={{
                                display: "flex",
                                gap: 1,
                                mt: 0.5,
                                mb: 0.5,
                              }}
                            >
                              <Chip
                                label={issue.status.name}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={issue.priority.name}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(issue.createdAt).toLocaleDateString()}{" "}
                              by{" "}
                              {issue.createdBy?.name ??
                                issue.submitterName ??
                                "Anonymous User"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", mt: 0.5 }}
                            >
                              {issue.machine.name || issue.machine.model.name}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>

              {recentIssues.length > 5 && (
                <Button
                  variant="text"
                  size="small"
                  fullWidth
                  sx={{ mt: 2 }}
                  href={`/machines/${selectedMachineId}`}
                >
                  View All Issues ({recentIssues.length})
                </Button>
              )}
            </>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              No recent issues for this machine
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
