"use client";

import {
  Edit,
  CalendarToday,
  Games,
  BugReport,
  Comment,
} from "@mui/icons-material";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
} from "@mui/material";
import React, { useState } from "react";

import type { JSX } from "react";

import { ProfilePictureUpload } from "~/components/profile/ProfilePictureUpload";
import { UserAvatar } from "~/components/ui/UserAvatar";
import { api } from "~/trpc/react";

export default function ProfilePage(): JSX.Element {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "" });

  const {
    data: userProfile,
    isLoading,
    error,
    refetch,
  } = api.user.getProfile.useQuery();

  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setEditDialogOpen(false);
      void refetch();
    },
  });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading profile...
        </Typography>
      </Container>
    );
  }

  if (error || !userProfile) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading profile: {error?.message ?? "Profile not found"}
        </Alert>
      </Container>
    );
  }

  const handleEditProfile = (): void => {
    setEditForm({
      name: userProfile.name ?? "",
      bio: userProfile.bio ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveProfile = (): void => {
    updateProfileMutation.mutate({
      name: editForm.name.trim() || undefined,
      bio: editForm.bio.trim() || undefined,
    });
  };

  const handleUploadSuccess = (): void => {
    setUploadDialogOpen(false);
    void refetch();
  };

  const joinDate = new Date(userProfile.createdAt);
  const formattedJoinDate = joinDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const _count = userProfile._count;
  const memberships = userProfile.memberships;
  const ownedMachines = userProfile.ownedMachines;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Profile Header */}
        <Grid size={12}>
          <Card elevation={2}>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 3, mb: 2 }}
              >
                <UserAvatar
                  user={userProfile}
                  size="large"
                  showTooltip={false}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" component="h1" gutterBottom>
                    {userProfile.name ?? "Unnamed User"}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    gutterBottom
                  >
                    {userProfile.email}
                  </Typography>
                  {userProfile.bio && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {userProfile.bio}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 2,
                    }}
                  >
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Joined {formattedJoinDate}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEditProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setUploadDialogOpen(true);
                    }}
                  >
                    Change Picture
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Statistics */}
        <Grid
          size={{
            xs: 12,
            md: 4,
          }}
        >
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Statistics
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Games color="primary" />
                  <Typography variant="body2">
                    {_count.ownedMachines} games owned
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BugReport color="secondary" />
                  <Typography variant="body2">
                    {_count.issuesCreated} issues reported
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Comment color="action" />
                  <Typography variant="body2">
                    {_count.comments} comments posted
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Organizations */}
        <Grid
          size={{
            xs: 12,
            md: 8,
          }}
        >
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Organizations
              </Typography>
              {memberships.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Not a member of any organizations
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {memberships.map((membership) => (
                    <Chip
                      key={membership.id}
                      label={`${membership.organization.name} (${membership.role.name})`}
                      color={
                        membership.role.name === "admin" ? "primary" : "default"
                      }
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Owned Games */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Owned Games ({ownedMachines.length})
              </Typography>
              {ownedMachines.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No games owned yet
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {ownedMachines.map((machine) => (
                    <Box
                      key={machine.id}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {machine.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {machine.model.name}
                        {machine.model.manufacturer && (
                          <> • {machine.model.manufacturer}</>
                        )}
                        {machine.model.year && <> • {machine.model.year}</>}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Location: {machine.location.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      {/* Edit Profile Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Display Name"
              value={editForm.name}
              onChange={(e) => {
                setEditForm({ ...editForm, name: e.target.value });
              }}
              fullWidth
              placeholder="Enter your display name"
            />
            <TextField
              label="Bio"
              value={editForm.bio}
              onChange={(e) => {
                setEditForm({ ...editForm, bio: e.target.value });
              }}
              fullWidth
              multiline
              rows={3}
              placeholder="Tell us about yourself..."
              slotProps={{ htmlInput: { maxLength: 500 } }}
              helperText={`${editForm.bio.length.toString()}/500 characters`}
            />
          </Box>
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
            onClick={handleSaveProfile}
            variant="contained"
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Upload Picture Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Profile Picture</DialogTitle>
        <DialogContent>
          <ProfilePictureUpload
            currentUser={userProfile}
            onUploadSuccess={handleUploadSuccess}
            size="large"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUploadDialogOpen(false);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
