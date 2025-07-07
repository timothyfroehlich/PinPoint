"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useCurrentUser } from "~/lib/hooks/use-current-user";
import { OPDBGameSearch } from "~/app/_components/opdb-game-search";
import type { OPDBSearchResult } from "~/lib/opdb/types";

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
import Grid2 from "@mui/material/Grid2";

// Type definitions for tRPC return types
type LocationWithRooms = {
  id: string;
  name: string;
  notes?: string | null;
  organizationId: string;
  pinballMapId?: number | null;
  rooms: {
    id: string;
    name: string;
    organizationId: string;
    description?: string | null;
    locationId: string;
    _count: {
      gameInstances: number;
    };
  }[];
};

type GameTitleWithCount = {
  id: string;
  name: string;
  manufacturer?: string | null;
  releaseDate?: Date | null;
  imageUrl?: string | null;
  description?: string | null;
  opdbId?: string | null;
  organizationId?: string | null;
  lastSynced?: Date | null;
  _count: {
    gameInstances: number;
  };
};

type GameInstanceWithDetails = {
  id: string;
  name: string;
  gameTitle: {
    id: string;
    name: string;
    manufacturer?: string | null;
    releaseDate?: Date | null;
    imageUrl?: string | null;
    description?: string | null;
    opdbId?: string | null;
    organizationId?: string | null;
    lastSynced?: Date | null;
  };
  room?: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  } | null;
  owner?: {
    id: string;
    name: string | null;
    profilePicture?: string | null;
  } | null;
};

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
  const { user, isAuthenticated } = useCurrentUser();
  const [tabValue, setTabValue] = useState(0);
  const [newLocationName, setNewLocationName] = useState("");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedGameTitleId, setSelectedGameTitleId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedOPDBGame, setSelectedOPDBGame] = useState<OPDBSearchResult | null>(null);

  // API queries
  const {
    data: gameTitles,
    isLoading: isLoadingGames,
    error: gameError,
    refetch: refetchGames,
  } = api.gameTitle.getAll.useQuery<GameTitleWithCount[]>();

  const {
    data: locations,
    isLoading: isLoadingLocations,
    error: locationError,
    refetch: refetchLocations,
  } = api.location.getAll.useQuery<LocationWithRooms[]>();

  const {
    data: gameInstances,
    isLoading: isLoadingInstances,
    error: instanceError,
    refetch: refetchInstances,
  } = api.gameInstance.getAll.useQuery();

  // Mutations

  const createGameFromOPDB = api.gameTitle.createFromOPDB.useMutation({
    onSuccess: () => {
      void api.useUtils().gameTitle.getAll.invalidate();
    },
  });

  const createLocation = api.location.create.useMutation({
    onSuccess: () => {
      setNewLocationName("");
      void api.useUtils().location.getAll.invalidate();
      void api.useUtils().room.getAll.invalidate();
    },
  });

  const createGameInstance = api.gameInstance.create.useMutation({
    onSuccess: () => {
      setNewInstanceName("");
      setSelectedLocationId("");
      setSelectedOPDBGame(null);
      void api.useUtils().location.getAll.invalidate();
      void api.useUtils().gameInstance.getAll.invalidate();
    },
  });


  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocationName.trim()) {
      createLocation.mutate({ name: newLocationName.trim() });
    }
  };

  const handleOPDBGameSelect = (opdbId: string, gameData: OPDBSearchResult) => {
    setSelectedOPDBGame(gameData);
    setSelectedGameTitleId(""); // Clear local game selection
  };

  const handleInstanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let gameTitleId = selectedGameTitleId;

    // If an OPDB game is selected but no local game title, create it first
    if (selectedOPDBGame && !selectedGameTitleId) {
      try {
        const newGameTitle = await createGameFromOPDB.mutateAsync({
          opdbId: selectedOPDBGame.id, // Use id instead of opdbId
        });
        gameTitleId = newGameTitle.id;
      } catch {
        // Error will be handled by the mutation's error state
        return;
      }
    }

    if (newInstanceName.trim() && selectedLocationId && gameTitleId) {
      createGameInstance.mutate({
        name: newInstanceName.trim(),
        roomId: selectedLocationId,
        gameTitleId,
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
                  Add New Game Title from OPDB
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Search the Open Pinball Database for games to add to your collection.
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <OPDBGameSearch
                    onGameSelect={handleOPDBGameSelect}
                    disabled={createGameFromOPDB.isPending}
                    placeholder="Search for pinball machines in OPDB..."
                  />

                  {selectedOPDBGame && (
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (selectedOPDBGame) {
                          createGameFromOPDB.mutate({
                            opdbId: selectedOPDBGame.id,
                          });
                        }
                      }}
                      disabled={createGameFromOPDB.isPending}
                      sx={{ alignSelf: "flex-start", minWidth: 120 }}
                    >
                      {createGameFromOPDB.isPending ? (
                        <CircularProgress size={24} />
                      ) : (
                        "Add Game"
                      )}
                    </Button>
                  )}
                </Box>

                {createGameFromOPDB.error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    Error adding game: {createGameFromOPDB.error.message}
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
                    {gameTitles?.map((game: GameTitleWithCount) => (
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
                    {locations?.map((location: LocationWithRooms) => {
                      // Sum game instances across all rooms
                      const gameCount = location.rooms?.reduce((sum: number, room) => sum + (room._count?.gameInstances ?? 0), 0) ?? 0;
                      return (
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
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {gameCount} games
                              </Typography>
                            }
                          />
                        </ListItem>
                      );
                    })}
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
                {locationCount === 0 ? (
                  <Alert severity="info">
                    You need to add at least one location before creating game instances.
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

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Typography variant="h6" component="h3">
                        Select or Search for Game
                      </Typography>

                      {gameTitleCount > 0 && (
                        <FormControl fullWidth>
                          <InputLabel>Existing Game Titles</InputLabel>
                          <Select
                            value={selectedGameTitleId}
                            onChange={(e) => {
                              setSelectedGameTitleId(e.target.value);
                              setSelectedOPDBGame(null); // Clear OPDB selection
                            }}
                            label="Existing Game Titles"
                            disabled={createGameInstance.isPending}
                          >
                            {gameTitles?.map((game: GameTitleWithCount) => (
                              <MenuItem key={game.id} value={game.id}>
                                {game.name}
                                {game.manufacturer && game.releaseDate && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: 1 }}
                                  >
                                    ({game.manufacturer}, {game.releaseDate.getFullYear()})
                                  </Typography>
                                )}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}

                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                        — OR —
                      </Typography>

                      <OPDBGameSearch
                        onGameSelect={handleOPDBGameSelect}
                        disabled={createGameInstance.isPending || createGameFromOPDB.isPending}
                        placeholder="Search OPDB for new games..."
                        label="Search OPDB Games"
                      />

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
                          {locations?.map((location: LocationWithRooms) => (
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
                        (!selectedGameTitleId && !selectedOPDBGame) ||
                        !selectedLocationId ||
                        createGameInstance.isPending ||
                        createGameFromOPDB.isPending
                      }
                      sx={{ alignSelf: "flex-start", minWidth: 120 }}
                    >
                      {createGameInstance.isPending || createGameFromOPDB.isPending ? (
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
                    {gameInstances?.map((instance: GameInstanceWithDetails) => (
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
                                {instance.gameTitle.name} at {instance.room?.location?.name ?? "Unknown Location"}
                              </Typography>
                              {instance.owner && instance.owner.name && (
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
