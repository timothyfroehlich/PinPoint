"use client";

import {
  QrCode as QrCodeIcon,
  Share as ShareIcon,
  Analytics as AnalyticsIcon,
} from "@mui/icons-material";
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

interface MockIssue {
  id: string;
  title: string;
  createdAt: string;
  status: { name: string };
  priority: { name: string };
  createdBy: { name: string } | null;
}

export function RecentIssuesSidebar({
  selectedMachineId,
  session: _session,
}: RecentIssuesSidebarProps): React.JSX.Element {
  // Mock data for recent issues - TODO: Replace with real API call
  const mockRecentIssues: MockIssue[] = selectedMachineId
    ? [
        {
          id: "1",
          title: "Ball gets stuck in shooter",
          createdAt: "2024-01-20T10:00:00Z",
          status: { name: "New" },
          priority: { name: "High" },
          createdBy: { name: "John Doe" },
        },
        {
          id: "2",
          title: "Flipper feels weak",
          createdAt: "2024-01-19T15:30:00Z",
          status: { name: "In Progress" },
          priority: { name: "Medium" },
          createdBy: null,
        },
        {
          id: "3",
          title: "Score display flickering",
          createdAt: "2024-01-18T09:15:00Z",
          status: { name: "Resolved" },
          priority: { name: "Low" },
          createdBy: { name: "Sarah Smith" },
        },
      ]
    : [];

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

          {mockRecentIssues.length > 0 ? (
            <>
              <List disablePadding>
                {mockRecentIssues.slice(0, 5).map((issue, index) => (
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
                              by {issue.createdBy?.name ?? "Anonymous User"}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>

              {mockRecentIssues.length > 5 && (
                <Button
                  variant="text"
                  size="small"
                  fullWidth
                  sx={{ mt: 2 }}
                  href={`/machines/${selectedMachineId}`}
                >
                  View All Issues ({mockRecentIssues.length})
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

      {/* Quick Actions Card */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<QrCodeIcon />}
              fullWidth
              onClick={() => {
                // TODO: Show QR code for machine
                console.log("Show QR code for machine:", selectedMachineId);
              }}
            >
              Get QR Code
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<ShareIcon />}
              fullWidth
              onClick={() => {
                // TODO: Share machine link
                console.log("Share machine:", selectedMachineId);
              }}
            >
              Share Machine
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<AnalyticsIcon />}
              fullWidth
              href={`/machines/${selectedMachineId}`}
            >
              View Machine Stats
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
