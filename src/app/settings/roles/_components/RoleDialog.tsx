"use client";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { api } from "~/trpc/react";

interface RoleDialogProps {
  open: boolean;
  roleId: string | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function RoleDialog({
  open,
  roleId,
  onClose,
  onSuccess,
}: RoleDialogProps): React.JSX.Element {
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name?: string; permissions?: string }>(
    {},
  );

  const isEditing = Boolean(roleId);

  const { data: permissions = {} } = api.admin.getPermissions.useQuery();

  const { data: roleDetails } = api.admin.getRoleDetails.useQuery(
    { roleId: roleId ?? "" },
    { enabled: Boolean(roleId) },
  );

  const createRoleMutation = api.admin.createRole.useMutation({
    onSuccess: () => {
      onSuccess(
        isEditing ? "Role updated successfully" : "Role created successfully",
      );
      handleClose();
    },
    onError: (error) => {
      if (error.message.includes("already exists")) {
        setErrors({ name: "Role name already exists" });
      } else {
        setErrors({ permissions: error.message });
      }
    },
  });

  const updateRoleMutation = api.admin.updateRole.useMutation({
    onSuccess: () => {
      onSuccess("Role updated successfully");
      handleClose();
    },
    onError: (error) => {
      if (error.message.includes("already exists")) {
        setErrors({ name: "Role name already exists" });
      } else {
        setErrors({ permissions: error.message });
      }
    },
  });

  // Load role data when editing
  useEffect(() => {
    if (isEditing && roleDetails) {
      setRoleName(roleDetails.name);
      setSelectedPermissions(roleDetails.permissions.map((p) => p.id));
    } else {
      setRoleName("");
      setSelectedPermissions([]);
    }
    setErrors({});
  }, [isEditing, roleDetails, open]);

  const handleClose = (): void => {
    setRoleName("");
    setSelectedPermissions([]);
    setErrors({});
    onClose();
  };

  const handlePermissionChange = (
    permissionId: string,
    checked: boolean,
  ): void => {
    setSelectedPermissions((prev) => {
      if (checked) {
        return [...prev, permissionId];
      }
      return prev.filter((id) => id !== permissionId);
    });
    setErrors((prev) => {
      const { permissions: _permissions, ...rest } = prev;
      return rest;
    });
  };

  const handleClearAll = (): void => {
    setSelectedPermissions([]);
  };

  const handleSubmit = (): void => {
    const newErrors: { name?: string; permissions?: string } = {};

    if (!roleName.trim()) {
      newErrors.name = "Role name is required";
    }

    if (selectedPermissions.length === 0) {
      newErrors.permissions = "At least one permission is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (isEditing && roleId) {
      updateRoleMutation.mutate({
        roleId,
        name: roleName,
        permissionIds: selectedPermissions,
      });
    } else {
      createRoleMutation.mutate({
        name: roleName,
        permissionIds: selectedPermissions,
      });
    }
  };

  const isLoading =
    createRoleMutation.isPending || updateRoleMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing
          ? `Edit Role: ${roleDetails?.name ?? ""}`
          : "Create New Role"}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <TextField
            fullWidth
            label="Role Name"
            value={roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              setErrors((prev) => {
                const { name: _name, ...rest } = prev;
                return rest;
              });
            }}
            error={Boolean(errors.name)}
            helperText={errors.name}
            name="roleName"
            sx={{ mb: 3 }}
          />

          <Typography variant="h6" gutterBottom>
            Permissions
          </Typography>

          {errors.permissions && (
            <Alert severity="error" sx={{ mb: 2 }} className="error-message">
              {errors.permissions}
            </Alert>
          )}

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select the permissions for this role
            </Typography>
            <Button size="small" onClick={handleClearAll}>
              Clear All
            </Button>
          </Box>

          <Box sx={{ maxHeight: 400, overflow: "auto" }}>
            {Object.entries(permissions).map(
              ([category, categoryPermissions]) => (
                <Box key={category} sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="medium"
                    gutterBottom
                  >
                    {category}
                  </Typography>

                  <FormControl component="fieldset" fullWidth>
                    <FormGroup>
                      {categoryPermissions.map((permission) => (
                        <FormControlLabel
                          key={permission.id}
                          control={
                            <Checkbox
                              checked={selectedPermissions.includes(
                                permission.id,
                              )}
                              onChange={(e) => {
                                handlePermissionChange(
                                  permission.id,
                                  e.target.checked,
                                );
                              }}
                              value={permission.name}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {permission.name}
                              </Typography>
                              {permission.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {permission.description}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                </Box>
              ),
            )}
          </Box>

          {selectedPermissions.length > 0 && (
            <Box
              sx={{ mt: 2, p: 2, backgroundColor: "grey.50", borderRadius: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                Selected: {selectedPermissions.length} permission(s)
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isLoading}>
          {isLoading
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save"
              : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
