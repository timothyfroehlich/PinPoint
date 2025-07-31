"use client";

import {
  Edit as EditIcon,
  PersonAdd as AssignIcon,
  Close as CloseIcon,
  SwapHoriz as TransferIcon,
  History as AuditLogIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
} from "@mui/material";
import { useState } from "react";

import type { PinPointSupabaseUser } from "../../../lib/supabase/types";

import { PermissionButton, PermissionGate } from "~/components/permissions";
import { api } from "~/trpc/react";
import { type IssueWithDetails } from "~/types/issue";

interface IssueActionsProps {
  issue: IssueWithDetails;
  user: PinPointSupabaseUser | null;
  hasPermission: (permission: string) => boolean;
  onError: (error: string) => void;
}

export function IssueActions({
  issue,
  user,
  hasPermission,
  onError,
}: IssueActionsProps): React.JSX.Element | null {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  // Menu anchor state for future implementation
  // const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [editTitle, setEditTitle] = useState(issue.title);
  const [editDescription, setEditDescription] = useState(
    issue.description ?? "",
  );

  const utils = api.useUtils();

  const updateIssue = api.issue.core.update.useMutation({
    onSuccess: () => {
      void utils.issue.core.getById.invalidate({ id: issue.id });
      setEditDialogOpen(false);
    },
    onError: (error) => {
      onError(error.message);
    },
  });

  const closeIssue = api.issue.core.close.useMutation({
    onSuccess: () => {
      void utils.issue.core.getById.invalidate({ id: issue.id });
    },
    onError: (error) => {
      onError(error.message);
    },
  });

  // Delete functionality not implemented - API endpoint doesn't exist

  const isAuthenticated = !!user;

  const handleEditSave = (): void => {
    updateIssue.mutate({
      id: issue.id,
      title: editTitle,
      description: editDescription,
    });
  };

  const handleClose = (): void => {
    closeIssue.mutate({ id: issue.id });
  };

  const handleAssignToSelf = (): void => {
    updateIssue.mutate({
      id: issue.id,
      assignedToId: user?.id,
    });
    setAssignDialogOpen(false);
  };

  // Menu handlers for future implementation
  // const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
  //   setAnchorEl(event.currentTarget);
  // };

  // const handleMenuClose = () => {
  //   setAnchorEl(null);
  // };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Actions
      </Typography>

      <Stack spacing={2}>
        {/* Edit Button */}
        <PermissionButton
          permission="issue:edit"
          hasPermission={hasPermission}
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => {
            setEditDialogOpen(true);
          }}
          data-testid="edit-issue-button"
          fullWidth
        >
          Edit Issue
        </PermissionButton>

        {/* Assign Button */}
        <PermissionButton
          permission="issue:assign"
          hasPermission={hasPermission}
          variant="outlined"
          startIcon={<AssignIcon />}
          onClick={() => {
            setAssignDialogOpen(true);
          }}
          data-testid="assign-user-button"
          fullWidth
        >
          Assign Issue
        </PermissionButton>

        {/* Close Button */}
        <PermissionButton
          permission="issue:edit"
          hasPermission={hasPermission}
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={handleClose}
          disabled={closeIssue.isPending}
          data-testid="close-issue-button"
          fullWidth
        >
          {closeIssue.isPending ? "Closing..." : "Close Issue"}
        </PermissionButton>

        {/* Admin Actions */}
        <PermissionGate
          permission="organization:manage"
          hasPermission={hasPermission}
          showFallback={false}
        >
          <Box data-testid="admin-actions">
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Admin Actions
            </Typography>

            <Stack direction="row" spacing={1}>
              <PermissionButton
                permission="issue:assign"
                hasPermission={hasPermission}
                showWhenDenied={false}
                variant="outlined"
                startIcon={<TransferIcon />}
                onClick={() => {
                  setTransferDialogOpen(true);
                }}
                data-testid="transfer-issue-button"
                size="small"
              >
                Transfer
              </PermissionButton>

              <PermissionButton
                permission="organization:manage"
                hasPermission={hasPermission}
                showWhenDenied={false}
                variant="outlined"
                startIcon={<AuditLogIcon />}
                onClick={() => {
                  // TODO: Implement audit log
                  onError("Audit log not yet implemented");
                }}
                data-testid="audit-log-button"
                size="small"
              >
                Audit Log
              </PermissionButton>
            </Stack>
          </Box>
        </PermissionGate>

        {/* Danger Zone - Delete functionality not yet implemented */}
        {/* TODO: Implement delete functionality when API endpoint exists */}
      </Stack>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Issue</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            type="text"
            fullWidth
            variant="outlined"
            value={editTitle}
            onChange={(e) => {
              setEditTitle(e.target.value);
            }}
            data-testid="title-input"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            value={editDescription}
            onChange={(e) => {
              setEditDescription(e.target.value);
            }}
            data-testid="description-textarea"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={updateIssue.isPending}
          >
            {updateIssue.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog
        open={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
        }}
      >
        <DialogTitle>Assign Issue</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose how to assign this issue:
          </Typography>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              onClick={handleAssignToSelf}
              data-testid="assign-to-self"
              fullWidth
            >
              Assign to Me
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                // TODO: Implement assign to other user
                onError("Assign to other user not yet implemented");
              }}
              data-testid="assign-to-other"
              fullWidth
            >
              Assign to Another User
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAssignDialogOpen(false);
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => {
          setTransferDialogOpen(false);
        }}
      >
        <DialogTitle>Transfer Issue</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select the target organization:
          </Typography>
          {/* TODO: Add organization select */}
          <TextField
            select
            fullWidth
            label="Target Organization"
            data-testid="target-organization-select"
            disabled
            helperText="Transfer functionality not yet implemented"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setTransferDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" disabled data-testid="confirm-transfer">
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
