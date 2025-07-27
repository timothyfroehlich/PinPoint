"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { type ReactElement } from "react";

interface RoleDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  roleId?: string;
}

export function RoleDialog({
  open,
  onClose,
  mode,
  roleId,
}: RoleDialogProps): ReactElement {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === "create" ? "Create Role" : "Edit Role"}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="text.secondary">
          Role management functionality coming soon...
          {roleId && ` (Role ID: ${roleId})`}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={onClose}>
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
