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
  Tooltip,
  Divider,
} from "@mui/material";
import { type Session } from "next-auth";
import { useState } from "react";

import { api } from "~/trpc/react";
import { type IssueWithDetails } from "~/types/issue";

interface IssueActionsProps {
  issue: IssueWithDetails;
  session: Session | null;
  hasPermission: (permission: string) => boolean;
  onError: (error: string) => void;
}

export function IssueActions({
  issue,
  session,
  hasPermission,
  onError,
}: IssueActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [_anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [editTitle, setEditTitle] = useState(issue.title);
  const [editDescription, setEditDescription] = useState(
    issue.description || "",
  );

  const utils = api.useUtils();

  const updateIssue = api.issue.core.update.useMutation({
    onSuccess: () => {
      utils.issue.core.getById.invalidate({ id: issue.id });
      setEditDialogOpen(false);
    },
    onError: (error) => {
      onError(error.message);
    },
  });

  const closeIssue = api.issue.core.close.useMutation({
    onSuccess: () => {
      utils.issue.core.getById.invalidate({ id: issue.id });
    },
    onError: (error) => {
      onError(error.message);
    },
  });

  // Delete functionality not implemented - API endpoint doesn't exist

  const isAuthenticated = !!session?.user;
  const canEdit = hasPermission("issues:edit");
  const canAssign = hasPermission("issues:assign");
  const canClose = hasPermission("issues:close");
  const canDelete = hasPermission("issues:delete");
  const canTransfer = hasPermission("issues:transfer");
  const isAdmin = hasPermission("admin");

  const handleEditSave = () => {
    updateIssue.mutate({
      id: issue.id,
      title: editTitle,
      description: editDescription,
    });
  };


  const handleClose = () => {
    closeIssue.mutate({ id: issue.id });
  };

  const handleAssignToSelf = () => {
    updateIssue.mutate({
      id: issue.id,
      assignedToId: session?.user?.id,
    });
    setAssignDialogOpen(false);
  };

  const _handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const _handleMenuClose = () => {
    setAnchorEl(null);
  };

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
        {canEdit ? (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
            data-testid="edit-issue-button"
            fullWidth
          >
            Edit Issue
          </Button>
        ) : (
          <Tooltip title="You need edit permissions to modify this issue">
            <span>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                disabled
                data-testid="disabled-edit-button"
                title="You need edit permissions to modify this issue"
                fullWidth
              >
                Edit Issue
              </Button>
            </span>
          </Tooltip>
        )}

        {/* Assign Button */}
        {canAssign ? (
          <Button
            variant="outlined"
            startIcon={<AssignIcon />}
            onClick={() => setAssignDialogOpen(true)}
            data-testid="assign-user-button"
            fullWidth
          >
            Assign Issue
          </Button>
        ) : (
          <Tooltip title="You need assign permissions to assign this issue">
            <span>
              <Button
                variant="outlined"
                startIcon={<AssignIcon />}
                disabled
                data-testid="disabled-assign-button"
                title="You need assign permissions to assign this issue"
                fullWidth
              >
                Assign Issue
              </Button>
            </span>
          </Tooltip>
        )}

        {/* Close Button */}
        {canClose ? (
          <Button
            variant="outlined"
            startIcon={<CloseIcon />}
            onClick={handleClose}
            disabled={closeIssue.isPending}
            data-testid="close-issue-button"
            fullWidth
          >
            {closeIssue.isPending ? "Closing..." : "Close Issue"}
          </Button>
        ) : (
          <Tooltip title="You need close permissions to close this issue">
            <span>
              <Button
                variant="outlined"
                startIcon={<CloseIcon />}
                disabled
                data-testid="disabled-close-button"
                title="You need close permissions to close this issue"
                fullWidth
              >
                Close Issue
              </Button>
            </span>
          </Tooltip>
        )}

        {/* Admin Actions */}
        {(canDelete || canTransfer || isAdmin) && (
          <Box data-testid="admin-actions">
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Admin Actions
            </Typography>

            <Stack direction="row" spacing={1}>
              {canTransfer && (
                <Button
                  variant="outlined"
                  startIcon={<TransferIcon />}
                  onClick={() => setTransferDialogOpen(true)}
                  data-testid="transfer-issue-button"
                  size="small"
                >
                  Transfer
                </Button>
              )}

              {isAdmin && (
                <Button
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
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {/* Danger Zone - Delete functionality not yet implemented */}
        {canDelete && false && (
          <Box data-testid="danger-actions">
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="error" gutterBottom>
              Danger Zone
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="delete-issue-button"
              fullWidth
            >
              Delete Issue
            </Button>
          </Box>
        )}
      </Stack>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
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
            onChange={(e) => setEditTitle(e.target.value)}
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
            onChange={(e) => setEditDescription(e.target.value)}
            data-testid="description-textarea"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
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
        onClose={() => setAssignDialogOpen(false)}
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
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>


      {/* Transfer Dialog */}
      <Dialog
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
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
          <Button onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled data-testid="confirm-transfer">
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
