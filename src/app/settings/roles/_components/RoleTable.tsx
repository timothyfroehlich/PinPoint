"use client";

import { Delete, Edit, Visibility } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { api } from "~/trpc/react";

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissionCount: number;
  memberCount: number;
}

interface RoleTableProps {
  roles: Role[];
  loading: boolean;
  onEdit: (roleId: string) => void;
  onSuccess: (message: string) => void;
}

export function RoleTable({
  roles,
  loading,
  onEdit,
  onSuccess,
}: RoleTableProps): React.JSX.Element {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [reassignRoleId, setReassignRoleId] = useState("");
  const [viewDetailsRole, setViewDetailsRole] = useState<string | null>(null);

  const deleteRoleMutation = api.admin.deleteRole.useMutation({
    onSuccess: () => {
      onSuccess("Role deleted successfully");
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      setReassignRoleId("");
    },
    onError: (error) => {
      console.error("Failed to delete role:", error);
    },
  });

  const { data: roleDetails } = api.admin.getRoleDetails.useQuery(
    { roleId: viewDetailsRole ?? "" },
    { enabled: !!viewDetailsRole },
  );

  const handleDeleteClick = (role: Role): void => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (): void => {
    if (!roleToDelete) return;

    deleteRoleMutation.mutate({
      roleId: roleToDelete.id,
      reassignRoleId: reassignRoleId || undefined,
    });
  };

  const handleDeleteCancel = (): void => {
    setDeleteDialogOpen(false);
    setRoleToDelete(null);
    setReassignRoleId("");
  };

  const handleViewDetails = (roleId: string): void => {
    setViewDetailsRole(roleId);
  };

  const handleCloseDetails = (): void => {
    setViewDetailsRole(null);
  };

  const availableRolesForReassignment = roles.filter(
    (role) => role.id !== roleToDelete?.id,
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Role Name</TableCell>
              <TableCell align="center">Permissions</TableCell>
              <TableCell align="center">Members</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <Typography variant="body1" fontWeight="medium">
                    {role.name}
                  </Typography>
                  {role.isSystem && (
                    <Typography variant="caption" color="text.secondary">
                      System Role
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">{role.permissionCount}</TableCell>
                <TableCell align="center">
                  {role.memberCount === 1
                    ? "1 user"
                    : `${role.memberCount.toString()} users`}
                </TableCell>
                <TableCell align="center">
                  <Box
                    sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => {
                        handleViewDetails(role.id);
                      }}
                      title="View Details"
                    >
                      <Visibility />
                    </IconButton>

                    {!role.isSystem && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => {
                            onEdit(role.id);
                          }}
                          title="Edit"
                        >
                          <Edit />
                        </IconButton>

                        <IconButton
                          size="small"
                          onClick={() => {
                            handleDeleteClick(role);
                          }}
                          title="Delete"
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the role "{roleToDelete?.name}"?
          </DialogContentText>

          {roleToDelete && roleToDelete.memberCount > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This role has {roleToDelete.memberCount.toString()} member(s).
                You must reassign them to another role.
              </Alert>

              <FormControl fullWidth>
                <InputLabel>Reassign members to</InputLabel>
                <Select
                  value={reassignRoleId}
                  onChange={(e) => {
                    setReassignRoleId(e.target.value);
                  }}
                  label="Reassign members to"
                  name="reassignRole"
                >
                  {availableRolesForReassignment.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={
              deleteRoleMutation.isPending ||
              Boolean(
                roleToDelete && roleToDelete.memberCount > 0 && !reassignRoleId,
              )
            }
          >
            {deleteRoleMutation.isPending ? "Deleting..." : "Confirm Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Details Dialog */}
      <Dialog
        open={!!viewDetailsRole}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Role Details</DialogTitle>
        <DialogContent>
          {roleDetails && (
            <Box className="role-details">
              <Typography variant="h6" gutterBottom>
                {roleDetails.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                {roleDetails.memberCount === 1
                  ? "1 user assigned"
                  : `${roleDetails.memberCount.toString()} users assigned`}
              </Typography>

              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Permissions ({roleDetails.permissionCount}):
              </Typography>

              <Box className="permission-list">
                {roleDetails.permissions.map((permission) => (
                  <Typography
                    key={permission.id}
                    variant="body2"
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      mr: 1,
                      mb: 1,
                      backgroundColor: "grey.100",
                      borderRadius: 1,
                      display: "inline-block",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                    }}
                  >
                    {permission.name}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
