"use client";

import { Delete } from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";

import { api } from "~/trpc/react";

export function InvitationList(): React.JSX.Element {
  const { data: invitations, isLoading } = api.invitation.list.useQuery();
  const utils = api.useUtils();

  const revokeInvitation = api.invitation.revoke.useMutation({
    onSuccess: async () => {
      await utils.invitation.list.invalidate();
    },
  });

  const handleRevoke = (invitationId: string): void => {
    revokeInvitation.mutate({ invitationId });
  };

  const getStatusColor = (
    status: string,
  ):
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning" => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "ACCEPTED":
        return "success";
      case "EXPIRED":
        return "error";
      case "REVOKED":
        return "default";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Typography variant="h6">Pending Invitations</Typography>
        </CardHeader>
        <CardContent>
          <Typography>Loading invitations...</Typography>
        </CardContent>
      </Card>
    );
  }

  const pendingInvitations =
    invitations?.filter((inv) => inv.status === "PENDING") ?? [];

  return (
    <Card>
      <CardHeader>
        <Typography variant="h6">Pending Invitations</Typography>
        <Typography variant="body2" color="text.secondary">
          {pendingInvitations.length === 0
            ? "No pending invitations"
            : `${pendingInvitations.length.toString()} pending invitation${pendingInvitations.length === 1 ? "" : "s"}`}
        </Typography>
      </CardHeader>

      {pendingInvitations.length > 0 && (
        <CardContent>
          <List>
            {pendingInvitations.map((invitation) => (
              <ListItem
                key={invitation.id}
                secondaryAction={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      label={invitation.status}
                      color={getStatusColor(invitation.status)}
                      size="small"
                    />
                    {invitation.status === "PENDING" && (
                      <IconButton
                        edge="end"
                        onClick={() => {
                          handleRevoke(invitation.id);
                        }}
                        disabled={revokeInvitation.isPending}
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </Box>
                }
              >
                <ListItemText
                  primary={invitation.email}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Role: {invitation.role.name} • Invited by:{" "}
                        {invitation.inviter.name ?? invitation.inviter.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Expires:{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      )}
    </Card>
  );
}
