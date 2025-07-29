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

// Interface for the public issue data returned by publicGetAll
interface PublicIssueData {
  id: string;
  title: string;
  createdAt: string | Date;
  submitterName?: string | null;
  status: {
    id: string;
    name: string;
    category: "NEW" | "IN_PROGRESS" | "RESOLVED";
    organizationId: string;
    isDefault: boolean;
  };
  priority: {
    id: string;
    name: string;
    order: number;
    organizationId: string;
    isDefault: boolean;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  machine: {
    id: string;
    name: string;
    model: {
      id: string;
      name: string;
      manufacturer: string | null;
      year: number | null;
    };
    location: {
      id: string;
      name: string;
      organizationId: string;
    };
  };
}

interface RecentIssuesSidebarProps {
  selectedMachineId: string | null;
  session: Session | null;
}

export function RecentIssuesSidebar({
  selectedMachineId,
  session: _session,
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

  // Get machine data either from issues or from the machines list
  const machineData =
    recentIssues?.[0]?.machine ??
    allMachines?.find((machine) => machine.id === selectedMachineId);

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
                {recentIssues
                  .slice(0, 5)
                  .map((issue: PublicIssueData, index: number) => (
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
