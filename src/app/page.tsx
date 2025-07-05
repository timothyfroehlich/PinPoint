"use client";

import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Grid,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from "@mui/material";
import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Home() {
  const [tabValue, setTabValue] = useState(0);
  const [newGameName, setNewGameName] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedGameTitleId, setSelectedGameTitleId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");

  // API queries
  const {
    data: gameTitles,
    isLoading: isLoadingGames,
    error: gameError,
    refetch: refetchGames,
  } = api.gameTitle.getAll.useQuery();

  const {
    data: locations,
    isLoading: isLoadingLocations,
    error: locationError,
    refetch: refetchLocations,
  } = api.location.getAll.useQuery();

  const {
    data: gameInstances,
    isLoading: isLoadingInstances,
    error: instanceError,
    refetch: refetchInstances,
  } = api.gameInstance.getAll.useQuery();

  // Mutations
  const createGameTitle = api.gameTitle.create.useMutation({
    onSuccess: () => {
      setNewGameName("");
      void refetchGames();
    },
  });

  const createLocation = api.location.create.useMutation({
    onSuccess: () => {
      setNewLocationName("");
      void refetchLocations();
    },
  });

  const createGameInstance = api.gameInstance.create.useMutation({
    onSuccess: () => {
      setNewInstanceName("");
      setSelectedGameTitleId("");
      setSelectedLocationId("");
      void refetchInstances();
    },
  });

  const handleGameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGameName.trim()) {
      createGameTitle.mutate({ name: newGameName.trim() });
    }
  };

  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocationName.trim()) {
      createLocation.mutate({ name: newLocationName.trim() });
    }
  };

  const handleInstanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newInstanceName.trim() && selectedGameTitleId && selectedLocationId) {
      createGameInstance.mutate({
        name: newInstanceName.trim(),
        gameTitleId: selectedGameTitleId,
        locationId: selectedLocationId,
      });
    }
  };

  const isLoading = isLoadingGames || isLoadingLocations || isLoadingInstances;
  const hasError = gameError ?? locationError ?? instanceError;

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Container>
    );
  }

  if (hasError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading data:{" "}
          {gameError?.message ??
            locationError?.message ??
            instanceError?.message}
        </Alert>
      </Container>
    );
  }

  const gameTitleCount = gameTitles?.length ?? 0;
  const locationCount = locations?.length ?? 0;
  const instanceCount = gameInstances?.length ?? 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          PinPoint
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Game Management
        </Typography>
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue as number)}
          aria-label="game management tabs"
        >
          <Tab label={`Game Titles (${gameTitleCount})`} />
          <Tab label={`Locations (${locationCount})`} />
          <Tab label={`Game Instances (${instanceCount})`} />
        </Tabs>
      </Box>
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Add New Game Title
                </Typography>
                <Box
                  component="form"
                  onSubmit={handleGameSubmit}
                  sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}
                >
                  <TextField
                    fullWidth
                    label="Game Title"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    placeholder="e.g., Medieval Madness, Attack from Mars"
                    disabled={createGameTitle.isPending}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!newGameName.trim() || createGameTitle.isPending}
                    sx={{ minWidth: 100 }}
                  >
                    {createGameTitle.isPending ? (
                      <CircularProgress size={24} />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </Box>
                {createGameTitle.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Error adding game: {createGameTitle.error.message}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={12}>
            <Card elevation={1}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Game Titles ({gameTitleCount})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {gameTitleCount === 0 ? (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    No game titles added yet. Use the form above to add your
                    first game!
                  </Typography>
                ) : (
                  <List>
                    {gameTitles?.map((game) => (
                      <ListItem key={game.id} sx={{ px: 0 }}>
                        <ListItemText primary={game.name} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Add New Location
                </Typography>
                <Box
                  component="form"
                  onSubmit={handleLocationSubmit}
                  sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}
                >
                  <TextField
                    fullWidth
                    label="Location Name"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="e.g., Main Floor, Upstairs, Basement"
                    disabled={createLocation.isPending}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      !newLocationName.trim() || createLocation.isPending
                    }
                    sx={{ minWidth: 100 }}
                  >
                    {createLocation.isPending ? (
                      <CircularProgress size={24} />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </Box>
                {createLocation.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Error adding location: {createLocation.error.message}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={12}>
            <Card elevation={1}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Locations ({locationCount})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {locationCount === 0 ? (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    No locations added yet. Use the form above to add your first
                    location!
                  </Typography>
                ) : (
                  <List>
                    {locations?.map((location) => (
                      <ListItem
                        key={location.id}
                        sx={{
                          px: 0,
                          "&:hover": {
                            backgroundColor: "action.hover",
                          },
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography
                              component={Link}
                              href={`/location/${location.id}`}
                              sx={{
                                textDecoration: "none",
                                color: "primary.main",
                                "&:hover": {
                                  textDecoration: "underline",
                                },
                              }}
                            >
                              {location.name}
                            </Typography>
                          }
                          secondary={
                            location._count?.gameInstances !== undefined && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {location._count.gameInstances} games
                              </Typography>
                            )
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <Card elevation={2}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Add New Game Instance
                </Typography>
                {gameTitleCount === 0 || locationCount === 0 ? (
                  <Alert severity="info">
                    You need to add at least one game title and one location
                    before creating game instances.
                  </Alert>
                ) : (
                  <Box
                    component="form"
                    onSubmit={handleInstanceSubmit}
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <TextField
                      fullWidth
                      label="Instance Name"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                      placeholder="e.g., MM #1, Medieval Madness (Left Side)"
                      disabled={createGameInstance.isPending}
                    />
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <FormControl fullWidth>
                        <InputLabel>Game Title</InputLabel>
                        <Select
                          value={selectedGameTitleId}
                          onChange={(e) =>
                            setSelectedGameTitleId(e.target.value)
                          }
                          label="Game Title"
                          disabled={createGameInstance.isPending}
                        >
                          {gameTitles?.map((game) => (
                            <MenuItem key={game.id} value={game.id}>
                              {game.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl fullWidth>
                        <InputLabel>Location</InputLabel>
                        <Select
                          value={selectedLocationId}
                          onChange={(e) =>
                            setSelectedLocationId(e.target.value)
                          }
                          label="Location"
                          disabled={createGameInstance.isPending}
                        >
                          {locations?.map((location) => (
                            <MenuItem key={location.id} value={location.id}>
                              {location.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={
                        !newInstanceName.trim() ||
                        !selectedGameTitleId ||
                        !selectedLocationId ||
                        createGameInstance.isPending
                      }
                      sx={{ alignSelf: "flex-start", minWidth: 100 }}
                    >
                      {createGameInstance.isPending ? (
                        <CircularProgress size={24} />
                      ) : (
                        "Add Instance"
                      )}
                    </Button>
                  </Box>
                )}
                {createGameInstance.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Error adding game instance:{" "}
                    {createGameInstance.error.message}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={12}>
            <Card elevation={1}>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Game Instances ({instanceCount})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {instanceCount === 0 ? (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    No game instances added yet. Use the form above to add your
                    first game instance!
                  </Typography>
                ) : (
                  <List>
                    {gameInstances?.map((instance) => (
                      <ListItem key={instance.id} sx={{ px: 0 }}>
                        <ListItemText
                          primary={instance.name}
                          secondary={
                            <Box
                              component="span"
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {instance.gameTitle.name} at{" "}
                                {instance.location.name}
                              </Typography>
                              {instance.owner && (
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Owner: {instance.owner.name}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Container>
  );
}
