"use client";

import {
  Edit as EditIcon,
  PersonRemove as RemoveIcon,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState, type ReactElement } from "react";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { api } from "~/trpc/react";

export function UserTable(): ReactElement {
  const { hasPermission } = usePermissions();
  const [editingUser, setEditingUser] = useState<string | null>(null);

  // Fetch users data
  const {
    data: users,
    isLoading,
    error,
  } = api.admin.getUsers.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds
  });

  const canManageUsers = hasPermission(PERMISSIONS.USER_MANAGE);

  const handleEditUser = (userId: string): void => {
    setEditingUser(userId);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Error loading users: {error.message}
      </Alert>
    );
  }

  if (!users || users.length === 0) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No users found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Invite your first user to get started.
        </Typography>
      </Card>
    );
  }

  return (
    <Box>
      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="center">Role</TableCell>
              <TableCell align="center">Status</TableCell>
              {canManageUsers && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isVerified = !!user.emailVerified;

              return (
                <TableRow key={user.userId} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {user.profilePicture ? (
                        <Avatar
                          src={user.profilePicture}
                          sx={{ width: 40, height: 40 }}
                        >
                          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                      ) : (
                        <Avatar sx={{ width: 40, height: 40 }}>
                          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </Avatar>
                      )}
                      <Box>
                        <Typography variant="subtitle2">
                          {user.name || "Unknown User"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{user.email}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={user.role.name}
                      size="small"
                      color={user.role.isSystem ? "default" : "primary"}
                      variant={user.role.isSystem ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={isVerified ? "Active" : "Invited"}
                      size="small"
                      color={isVerified ? "success" : "warning"}
                      variant="outlined"
                    />
                  </TableCell>
                  {canManageUsers && (
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        <Tooltip title="Edit Role">
                          <IconButton
                            size="small"
                            onClick={() => {
                              handleEditUser(user.userId);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Remove User">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              console.log("Remove user:", user.userId);
                            }}
                          >
                            <RemoveIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit User Role Dialog - Coming soon */}
      {editingUser && (
        <div>Edit user dialog for {editingUser} - Coming soon</div>
      )}
    </Box>
  );
}
