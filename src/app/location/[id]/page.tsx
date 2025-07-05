"use client";

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
import {
  Edit,
  MoreVert,
  Games,
  LocationOn,
  MoveUp,
  Person,
  BugReport,
} from "@mui/icons-material";
import { useState } from "react";
import React from "react";
// import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const [selectedGameInstanceId, setSelectedGameInstanceId] = useState<
    string | null
  >(null);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [gameMenuAnchor, setGameMenuAnchor] = useState<null | HTMLElement>(
    null,
  );
  const [editForm, setEditForm] = useState({ name: "", notes: "" });
  const [issueForm, setIssueForm] = useState({
    gameInstanceId: "",
    title: "",
    severity: "" as "Low" | "Medium" | "High" | "Critical" | "",
    description: "",
    reporterEmail: "",
  });

  const { user, isAuthenticated } = useCurrentUser();

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

  const moveGameMutation = api.gameInstance.moveToLocation.useMutation({
    onSuccess: () => {
      setMoveDialogOpen(false);
      setSelectedGameInstanceId(null);
      setTargetLocationId("");
      void refetch();
    },
  });

  const createIssueMutation = api.issue.create.useMutation({
    onSuccess: () => {
      setIssueForm({
        gameInstanceId: "",
        title: "",
        severity: "",
        description: "",
        reporterEmail: "",
      });
      void refetch();
    },
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
    gameInstanceId: string,
  ) => {
    setSelectedGameInstanceId(gameInstanceId);
    setGameMenuAnchor(event.currentTarget);
  };

  const handleMoveGame = () => {
    setGameMenuAnchor(null);
    setMoveDialogOpen(true);
  };

  const handleConfirmMove = () => {
    if (selectedGameInstanceId && targetLocationId) {
      moveGameMutation.mutate({
        gameInstanceId: selectedGameInstanceId,
        locationId: targetLocationId,
      });
    }
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.gameInstanceId || !issueForm.title.trim()) return;

    createIssueMutation.mutate({
      title: issueForm.title.trim(),
      description: issueForm.description.trim() || undefined,
      severity: issueForm.severity || undefined,
      reporterEmail: !isAuthenticated
        ? issueForm.reporterEmail.trim() || undefined
        : undefined,
      gameInstanceId: issueForm.gameInstanceId,
    });
  };

  const otherLocations =
    allLocations?.filter((loc) => loc.id !== location.id) ?? [];
  const selectedGame = location.gameInstances.find(
    (gi) => gi.id === selectedGameInstanceId,
  );

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
                      label={`${location.gameInstances.length} games`}
                      variant="outlined"
                    />
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={handleEditLocation}
                  disabled={updateLocationMutation.isPending}
                >
                  Edit Location
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Game Instances */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Games at this Location ({location.gameInstances.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {location.gameInstances.length === 0 ? (
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
                  {location.gameInstances.map((gameInstance) => (
                    <ListItem
                      key={gameInstance.id}
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
                              {gameInstance.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              ({gameInstance.gameTitle.name})
                            </Typography>
                          </Box>
                        }
                        secondary={
                          gameInstance.owner && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mt: 0.5,
                              }}
                            >
                              <Person fontSize="small" color="action" />
                              <UserAvatar
                                user={gameInstance.owner}
                                size="small"
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Owned by {gameInstance.owner.name}
                              </Typography>
                            </Box>
                          )
                        }
                      />
                      <IconButton
                        onClick={(e) => handleGameMenu(e, gameInstance.id)}
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
          <Card>
            <CardContent>
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}
              >
                <BugReport color="primary" />
                <Typography variant="h6">Report an Issue</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              {location.gameInstances.length === 0 ? (
                <Alert severity="info">
                  No games available at this location to report issues for.
                </Alert>
              ) : (
                <Box
                  component="form"
                  onSubmit={handleIssueSubmit}
                  sx={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  {/* Game Selection */}
                  <FormControl fullWidth>
                    <InputLabel>Game *</InputLabel>
                    <Select
                      value={issueForm.gameInstanceId}
                      onChange={(e) =>
                        setIssueForm({
                          ...issueForm,
                          gameInstanceId: e.target.value,
                        })
                      }
                      label="Game *"
                      required
                    >
                      <MenuItem value="">
                        <em>Select a game...</em>
                      </MenuItem>
                      {location.gameInstances.map((instance) => (
                        <MenuItem key={instance.id} value={instance.id}>
                          {instance.name} ({instance.gameTitle.name})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Grid container spacing={2}>
                    {/* Title */}
                    <Grid
                      size={{
                        xs: 12,
                        md: 8,
                      }}
                    >
                      <TextField
                        fullWidth
                        label="Issue Title *"
                        value={issueForm.title}
                        onChange={(e) =>
                          setIssueForm({ ...issueForm, title: e.target.value })
                        }
                        placeholder="Brief description of the problem"
                        inputProps={{ maxLength: 255 }}
                        helperText={`${issueForm.title.length}/255 characters`}
                        required
                      />
                    </Grid>

                    {/* Severity */}
                    <Grid
                      size={{
                        xs: 12,
                        md: 4,
                      }}
                    >
                      <FormControl fullWidth>
                        <InputLabel>Severity</InputLabel>
                        <Select
                          value={issueForm.severity}
                          onChange={(e) =>
                            setIssueForm({
                              ...issueForm,
                              severity: e.target.value as
                                | "Low"
                                | "Medium"
                                | "High"
                                | "Critical"
                                | "",
                            })
                          }
                          label="Severity"
                        >
                          <MenuItem value="">
                            <em>Select severity...</em>
                          </MenuItem>
                          <MenuItem value="Low">Low</MenuItem>
                          <MenuItem value="Medium">Medium</MenuItem>
                          <MenuItem value="High">High</MenuItem>
                          <MenuItem value="Critical">Critical</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Description */}
                  <TextField
                    fullWidth
                    label="Description"
                    value={issueForm.description}
                    onChange={(e) =>
                      setIssueForm({
                        ...issueForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Detailed description of the issue..."
                    multiline
                    rows={3}
                    inputProps={{ maxLength: 1000 }}
                    helperText={`${issueForm.description.length}/1000 characters`}
                  />

                  {/* Reporter Information */}
                  {isAuthenticated ? (
                    <Alert
                      severity="info"
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Person />
                      Reporting as:{" "}
                      {user?.name ?? user?.email ?? "Authenticated User"}
                    </Alert>
                  ) : (
                    <TextField
                      fullWidth
                      label="Get notified for updates? (Optional)"
                      type="email"
                      value={issueForm.reporterEmail}
                      onChange={(e) =>
                        setIssueForm({
                          ...issueForm,
                          reporterEmail: e.target.value,
                        })
                      }
                      placeholder="Email address"
                      helperText="Leave blank to report anonymously"
                    />
                  )}

                  {/* Submit Button */}
                  <Box
                    sx={{
                      display: "flex",
                      gap: 2,
                      justifyContent: "flex-start",
                    }}
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={
                        !issueForm.gameInstanceId ||
                        !issueForm.title.trim() ||
                        createIssueMutation.isPending
                      }
                      sx={{ minWidth: 140 }}
                    >
                      {createIssueMutation.isPending ? (
                        <CircularProgress size={24} />
                      ) : (
                        "Submit Issue"
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() =>
                        setIssueForm({
                          gameInstanceId: "",
                          title: "",
                          severity: "",
                          description: "",
                          reporterEmail: "",
                        })
                      }
                      disabled={createIssueMutation.isPending}
                    >
                      Clear Form
                    </Button>
                  </Box>

                  {/* Success/Error Messages */}
                  {createIssueMutation.isSuccess && (
                    <Alert severity="success">
                      Issue submitted successfully! It will be reviewed by the
                      staff.
                    </Alert>
                  )}

                  {createIssueMutation.error && (
                    <Alert severity="error">
                      Error submitting issue:{" "}
                      {createIssueMutation.error.message}
                    </Alert>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
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
                {selectedGame.gameTitle.name})
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
                    {loc.name} ({loc._count.gameInstances} games)
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
    </Container>
  );
}
