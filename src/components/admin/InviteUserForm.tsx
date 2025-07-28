"use client";

import { Email, PersonAdd } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { api } from "~/trpc/react";

export function InviteUserForm(): React.JSX.Element {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // Get available roles
  const { data: roles, isLoading: rolesLoading } =
    api.invitation.getRoles.useQuery();

  // Create invitation mutation
  const createInvitation = api.invitation.create.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setEmail("");
      setRoleId("");
      setMessage("");
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!email || !roleId) return;

    createInvitation.mutate({
      email,
      roleId,
      message: message || undefined,
    });
  };

  const isSubmitting = createInvitation.isPending;
  const error = createInvitation.error;

  return (
    <Card>
      <CardHeader>
        <Typography
          variant="h5"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <PersonAdd />
          Invite Team Member
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Send an invitation to join your organization
        </Typography>
      </CardHeader>

      <CardContent>
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Invitation sent successfully! The user will receive an email with
            instructions to join.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error.message}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <TextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            required
            fullWidth
            disabled={isSubmitting}
            placeholder="colleague@example.com"
            slotProps={{
              input: {
                startAdornment: (
                  <Email sx={{ mr: 1, color: "text.secondary" }} />
                ),
              },
            }}
          />

          <FormControl
            fullWidth
            required
            disabled={isSubmitting || rolesLoading}
          >
            <InputLabel>Role</InputLabel>
            <Select
              value={roleId}
              label="Role"
              onChange={(e) => {
                setRoleId(e.target.value);
              }}
            >
              {roles?.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Personal Message (Optional)"
            multiline
            rows={3}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
            }}
            disabled={isSubmitting}
            placeholder="Welcome to the team! Looking forward to working with you."
            helperText="This message will be included in the invitation email"
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting || !email || !roleId}
            sx={{ alignSelf: "flex-start" }}
          >
            {isSubmitting ? "Sending Invitation..." : "Send Invitation"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
