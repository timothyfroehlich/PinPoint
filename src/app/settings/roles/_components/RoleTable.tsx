"use client";

import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import {
  Alert,
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
import { type ReactElement } from "react";

import { usePermissions } from "~/hooks/usePermissions";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { api } from "~/trpc/react";

export function RoleTable(): ReactElement {
  const { hasPermission } = usePermissions();

  // Fetch roles data
  const {
    data: roles,
    isLoading,
    error,
  } = api.role.list.useQuery(undefined, {
    staleTime: 30 * 1000, // 30 seconds
  });

  const canManageRoles = hasPermission(PERMISSIONS.ROLE_MANAGE);

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
        Error loading roles: {error.message}
      </Alert>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No roles found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first role to get started.
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
              <TableCell>Role Name</TableCell>
              <TableCell align="center">Permissions</TableCell>
              <TableCell align="center">Members</TableCell>
              <TableCell align="center">Type</TableCell>
              {canManageRoles && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => {
              const isSystemRole = role.isSystem;
              const canEdit = canManageRoles && !isSystemRole;
              const canDelete = canManageRoles && !isSystemRole;

              return (
                <TableRow key={role.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">{role.name}</Typography>
                      {role.isDefault && (
                        <Chip
                          label="Default"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">
                      {role.permissions.length}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">
                      {role.memberCount === 1
                        ? "1 user"
                        : `${String(role.memberCount)} users`}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={isSystemRole ? "System" : "Custom"}
                      size="small"
                      color={isSystemRole ? "default" : "primary"}
                      variant={isSystemRole ? "filled" : "outlined"}
                    />
                  </TableCell>
                  {canManageRoles && (
                    <TableCell align="center">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "center",
                        }}
                      >
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              console.log("View role:", role.id);
                            }}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>

                        {canEdit && (
                          <Tooltip title="Edit Role">
                            <IconButton
                              size="small"
                              onClick={() => {
                                console.log("Edit role:", role.id);
                              }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {canDelete && (
                          <Tooltip title="Delete Role">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                console.log("Delete role:", role.id);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
