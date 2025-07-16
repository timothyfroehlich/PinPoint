"use client";

import {
  Edit,
  MoreVert,
  Games,
  LocationOn,
  MoveUp,
  Person,
} from "@mui/icons-material";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import React from "react";
// import { useRouter } from "next/navigation";

import { IssueSubmissionForm } from "~/app/_components/issue-submission-form";
import { UserAvatar } from "~/app/_components/user-avatar";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { api } from "~/trpc/react";

interface LocationProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function LocationProfilePage({
  params,
}: LocationProfilePageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null,
  );

  // Resolve the params Promise
  React.useEffect(() => {
    void params.then(setResolvedParams);
  }, [params]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(
    null,
  );
  const [targetLocationId, setTargetLocationId] = useState("");
  const [gameMenuAnchor, setGameMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [editForm, setEditForm] = useState({ name: "", notes: "" });
  const [pinballMapDialogOpen, setPinballMapDialogOpen] = useState(false);
  const [pinballMapId, setPinballMapId] = useState<number | null>(null);

  const { isAuthenticated } = useCurrentUser();

  const {
    data: location,
    isLoading,
    error,
    refetch,
  } = api.location.getById.useQuery(
    { id: resolvedParams?.id ?? "" },
    { enabled: !!resolvedParams?.id },
  );

  const { data: allLocations } = api.location.getAll.useQuery();

  const updateLocationMutation = api.location.update.useMutation({
    onSuccess: () => {
      setEditDialogOpen(false);
      void refetch();
    },
  });

  const moveGameMutation = api.machine.moveToLocation.useMutation({
    onSuccess: () => {
      setMoveDialogOpen(false);
      setSelectedMachineId(null);
      setTargetLocationId("");
      void refetch();
    },
  });

  const setPinballMapIdMutation = api.location.setPinballMapId.useMutation({
    onSuccess: () => {
      setPinballMapDialogOpen(false);
      setPinballMapId(null);
      void refetch();
    },
  });

  const syncWithPinballMapMutation =
    api.location.syncWithPinballMap.useMutation({
      onSuccess: (result) => {
        // Show success message with sync results
        console.log(
          `Sync completed: ${result.added} added, ${result.removed} removed`,
        );
        void refetch();
      },
    });

  // Get user profile with membership information - MOVED BEFORE EARLY RETURNS
  const { data: userProfile } = api.user.getProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (!resolvedParams || isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading location...
        </Typography>
      </Container>
    );
  }

  if (error || !location) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading location: {error?.message ?? "Location not found"}
        </Alert>
      </Container>
    );
  }

  // NEW: Flatten all game instances from all rooms
  const allMachines = location.rooms.flatMap((room) => room.machines);

  // Check if user is admin
  const isAdmin =
    userProfile?.memberships?.some(
      (membership) => membership.role === "admin",
    ) ?? false;

  const handleEditLocation = () => {
    setEditForm({
      name: location.name ?? "",
      notes: location.notes ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveLocation = () => {
    updateLocationMutation.mutate({
      id: location.id,
      name: editForm.name.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
    });
  };

  const handleGameMenu = (
    event: React.MouseEvent<HTMLElement>,
    machineId: string,
  ) => {
    setSelectedMachineId(machineId);
    setGameMenuAnchor(event.currentTarget);
  };

  const handleMoveGame = () => {
    setGameMenuAnchor(null);
    setMoveDialogOpen(true);
  };

  const handlePinballMapSetup = () => {
    setPinballMapId(location.pinballMapId ?? null);
    setPinballMapDialogOpen(true);
  };

  const handlePinballMapSave = () => {
    if (pinballMapId && pinballMapId > 0) {
      setPinballMapIdMutation.mutate({
        locationId: location.id,
        pinballMapId: pinballMapId,
      });
    }
  };

  const handlePinballMapSync = () => {
    syncWithPinballMapMutation.mutate({
      locationId: location.id,
    });
  };

  const handleConfirmMove = () => {
    if (selectedMachineId && targetLocationId) {
      moveGameMutation.mutate({
        machineId: selectedMachineId,
        locationId: targetLocationId, // This should be locationId now
      });
    }
  };

  const otherLocations =
    allLocations?.filter((loc) => loc.id !== location.id) ?? [];
  // Update selectedGame to use allMachines
  const selectedGame = allMachines.find((gi) => gi.id === selectedMachineId);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumb */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            Game Management
          </Link>
          {" > "}
          <Typography component="span" variant="body2" color="primary">
            {location.name}
          </Typography>
        </Typography>
      </Box>
      <Grid container spacing={3}>
        {/* Location Header */}
        <Grid size={12}>
          <Card elevation={2}>
            <CardContent>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  mb: 2,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      mb: 1,
                    }}
                  >
                    <LocationOn color="primary" fontSize="large" />
                    <Typography variant="h4" component="h1">
                      {location.name}
                    </Typography>
                  </Box>
                  {location.notes && (
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {location.notes}
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip
                      icon={<Games />}
                      label={`${allMachines.length} games`}
                      variant="outlined"
                    />
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  {isAdmin && (
                    <>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={handlePinballMapSetup}
                        disabled={setPinballMapIdMutation.isPending}
                        size="small"
                      >
                        {location.pinballMapId
                          ? "Update PinballMap ID"
                          : "Set PinballMap ID"}
                      </Button>
                      {location.pinballMapId && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handlePinballMapSync}
                          disabled={syncWithPinballMapMutation.isPending}
                          size="small"
                        >
                          {syncWithPinballMapMutation.isPending
                            ? "Syncing..."
                            : "Sync with PinballMap"}
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEditLocation}
                    disabled={updateLocationMutation.isPending}
                  >
                    Edit Location
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Game Instances */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Games at this Location ({allMachines.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {allMachines.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Games
                    sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
                  />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No games at this location
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Games can be moved here from other locations
                  </Typography>
                </Box>
              ) : (
                <List>
                  {allMachines.map((machine) => (
                    <ListItem
                      key={machine.id}
                      sx={{
                        px: 0,
                        py: 1,
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography variant="subtitle1" fontWeight="medium">
                              {machine.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              ({machine.model.name})
                            </Typography>
                          </Box>
                        }
                        secondary={
                          machine.owner && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mt: 0.5,
                              }}
                            >
                              <Person fontSize="small" color="action" />
                              <UserAvatar user={machine.owner} size="small" />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Owned by {machine.owner.name}
                              </Typography>
                            </Box>
                          )
                        }
                      />
                      <IconButton
                        onClick={(e) => handleGameMenu(e, machine.id)}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Issue Submission Form */}
        <Grid size={12}>
          <IssueSubmissionForm
            machines={allMachines}
            onSuccess={() => refetch()}
          />
        </Grid>
      </Grid>
      {/* Edit Location Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Location</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="Location Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              fullWidth
              placeholder="Enter location name"
            />
            <TextField
              label="Notes"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
              placeholder="Add notes about this location..."
              inputProps={{ maxLength: 1000 }}
              helperText={`${editForm.notes.length}/1000 characters`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveLocation}
            variant="contained"
            disabled={updateLocationMutation.isPending || !editForm.name.trim()}
          >
            {updateLocationMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Game Actions Menu */}
      <Menu
        anchorEl={gameMenuAnchor}
        open={Boolean(gameMenuAnchor)}
        onClose={() => setGameMenuAnchor(null)}
      >
        <MenuItem onClick={handleMoveGame}>
          <MoveUp sx={{ mr: 2 }} />
          Move to Different Location
        </MenuItem>
      </Menu>
      {/* Move Game Dialog */}
      <Dialog
        open={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Move Game Instance</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {selectedGame && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Moving <strong>{selectedGame.name}</strong> (
                {selectedGame.model.name})
              </Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Target Location</InputLabel>
              <Select
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
                label="Target Location"
              >
                {otherLocations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name} (
                    {loc.rooms?.reduce(
                      (sum, room) => sum + (room._count?.machines ?? 0),
                      0,
                    ) ?? 0}{" "}
                    games)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmMove}
            variant="contained"
            disabled={moveGameMutation.isPending || !targetLocationId}
          >
            {moveGameMutation.isPending ? "Moving..." : "Move Game"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PinballMap Setup Dialog */}
      <Dialog
        open={pinballMapDialogOpen}
        onClose={() => setPinballMapDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {location.pinballMapId ? "Update PinballMap ID" : "Set PinballMap ID"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Enter the PinballMap.com location ID to enable syncing with their
              database. You can find this ID in the URL when viewing your
              location on PinballMap.com (e.g., pinballmap.com/locations/26454).
            </Alert>
            <TextField
              label="PinballMap Location ID"
              type="number"
              value={pinballMapId ?? ""}
              onChange={(e) =>
                setPinballMapId(parseInt(e.target.value) || null)
              }
              fullWidth
              placeholder="e.g., 26454"
              helperText={`Current ID: ${location.pinballMapId ?? "Not set"}`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinballMapDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handlePinballMapSave}
            variant="contained"
            disabled={
              setPinballMapIdMutation.isPending ||
              !pinballMapId ||
              pinballMapId <= 0
            }
          >
            {setPinballMapIdMutation.isPending ? "Saving..." : "Save ID"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
