"use client";

import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  CircularProgress,
} from "@mui/material";
import * as React from "react";
import { useState } from "react";

import type { PinPointSupabaseUser } from "~/lib/supabase/types";

import { api } from "~/trpc/react";
import {
  type IssueWithRelationsResponse,
  type IssueStatus,
} from "~/lib/types/api";

interface IssueStatusControlProps {
  issue: NonNullable<IssueWithRelationsResponse>;
  user: PinPointSupabaseUser | null;
  hasPermission: (permission: string) => boolean;
  onError: (error: string) => void;
}

export function IssueStatusControl({
  issue,
  user: _user,
  hasPermission,
  onError,
}: IssueStatusControlProps): React.JSX.Element {
  const [selectedStatusId, setSelectedStatusId] = useState(issue.statusId);
  const [isUpdating, setIsUpdating] = useState(false);

  const utils = api.useUtils();

  // Fetch available statuses for the organization
  const statusQuery = api.issueStatus.getAll.useQuery();
  const statuses = statusQuery.data as IssueStatus[] | undefined;
  const statusesLoading = statusQuery.isLoading;

  const updateStatus = api.issue.core.update.useMutation({
    onSuccess: () => {
      void utils.issue.core.getById.invalidate({ id: issue.id });
      setIsUpdating(false);
    },
    onError: (error) => {
      onError(error.message);
      setSelectedStatusId(issue.statusId); // Reset to original
      setIsUpdating(false);
    },
  });

  const handleStatusChange = (newStatusId: string): void => {
    setSelectedStatusId(newStatusId);
    setIsUpdating(true);

    updateStatus.mutate({
      id: issue.id,
      statusId: newStatusId,
    });
  };

  const canEditStatus = hasPermission("issues:edit");

  if (statusesLoading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Status
        </Typography>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Status
      </Typography>

      <Stack spacing={2}>
        {/* Current Status Display */}
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Current Status
          </Typography>
          <Chip
            label={issue.status.name}
            color="primary"
            variant="filled"
            sx={{
              backgroundColor: issue.status.color ?? "#666",
              color: "white",
            }}
          />
        </Box>

        {/* Status Change Control */}
        {canEditStatus &&
          statuses &&
          Array.isArray(statuses) &&
          statuses.length > 0 && (
            <Box>
              <FormControl fullWidth>
                <InputLabel id="status-select-label">Change Status</InputLabel>
                <Select
                  labelId="status-select-label"
                  value={selectedStatusId}
                  label="Change Status"
                  onChange={(e) => {
                    handleStatusChange(e.target.value);
                  }}
                  disabled={isUpdating}
                  data-testid="status-dropdown"
                >
                  {statuses.map((status) => (
                    <MenuItem
                      key={status.id}
                      value={status.id}
                      data-testid={`status-option-${status.name.toLowerCase().replace(" ", "-")}`}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            backgroundColor: status.color,
                          }}
                        />
                        <Typography>{status.name}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {isUpdating && (
                <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                  <CircularProgress
                    size={16}
                    sx={{ mr: 1 }}
                    data-testid="status-loading"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Updating status...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

        {/* Status History/Activity */}
        {/* TODO: Add status change history */}
        <Box data-testid="status-change-activity" sx={{ display: "none" }}>
          <Typography variant="body2" color="text.secondary">
            Status change recorded
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
