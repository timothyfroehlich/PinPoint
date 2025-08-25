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
import * as React from "react";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { api } from "~/trpc/react";

interface RecentIssuesSidebarProps {
  selectedMachineId: string | null;
  user: PinPointSupabaseUser | null;
}

export function RecentIssuesSidebar({
  selectedMachineId,
  user: _user,
}: RecentIssuesSidebarProps): React.JSX.Element {
  // Fetch recent issues for the selected machine using public endpoint
  const { data: recentIssues } = api.issue.core.publicGetAll.useQuery(
    {
      machineId: selectedMachineId ?? undefined,
      sortBy: "created",
      sortOrder: "desc",
      limit: 10,
    },
    {
      enabled: !!selectedMachineId,
    },
  );

  // Fetch all machines to get machine data for display (fallback when no issues exist)
  const { data: allMachines } = api.machine.core.getAllForIssues.useQuery(
    undefined,
    {
      enabled: !!selectedMachineId,
    },
  );

  // Get machine data from the machines list since issues don't include full machine relations
  const machineData = allMachines?.find(
    (machine: { id: string }) => machine.id === selectedMachineId,
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
                {recentIssues.slice(0, 5).map(
                  (
                    issue: Record<string, unknown> & {
                      id: string;
                      title: string;
                    },
                    index: number,
                  ) => (
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
                                  label={
                                    (
                                      issue["status"] as {
                                        name?: string;
                                      } | null
                                    )?.name ?? "Unknown Status"
                                  }
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip
                                  label={
                                    (
                                      issue["priority"] as {
                                        name?: string;
                                      } | null
                                    )?.name ?? "Unknown Priority"
                                  }
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {new Date(
                                  (issue["created_at"] ??
                                    issue["createdAt"]) as
                                    | string
                                    | number
                                    | Date,
                                ).toLocaleDateString()}{" "}
                                by{" "}
                                {String(
                                  (
                                    issue["createdBy"] as {
                                      name?: string;
                                    } | null
                                  )?.name ??
                                    issue["submitter_name"] ??
                                    issue["submitterName"] ??
                                    "Anonymous User",
                                )}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", mt: 0.5 }}
                              >
                                {(
                                  issue["machine"] as {
                                    name?: string;
                                    model?: { name?: string };
                                  } | null
                                )?.name ??
                                  (
                                    issue["machine"] as {
                                      name?: string;
                                      model?: { name?: string };
                                    } | null
                                  )?.model?.name ??
                                  "Unknown Machine"}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ),
                )}
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
