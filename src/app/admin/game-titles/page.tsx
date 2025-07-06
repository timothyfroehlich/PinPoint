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
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Games,
  Sync,
  MoreVert,
  Delete,
  CalendarToday,
  Business,
} from "@mui/icons-material";
import { useState } from "react";
import { api } from "~/trpc/react";
import { OPDBGameSearch } from "~/app/_components/opdb-game-search";
import type { OPDBSearchResult } from "~/lib/opdb";

export default function GameTitlesAdminPage() {
  const [selectedOPDBGame, setSelectedOPDBGame] = useState<{
    opdbId: string;
    gameData: OPDBSearchResult;
  } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Queries
  const {
    data: gameTitles,
    isLoading: isLoadingGames,
    error: gameError,
    refetch: refetchGames,
  } = api.gameTitle.getAll.useQuery();

  // Mutations
  const createGameFromOPDB = api.gameTitle.createFromOPDB.useMutation({
    onSuccess: () => {
      setSelectedOPDBGame(null);
      void refetchGames();
    },
  });

  const syncWithOPDB = api.gameTitle.syncWithOPDB.useMutation({
    onSuccess: () => {
      void refetchGames();
    },
  });

  const deleteGameTitle = api.gameTitle.delete.useMutation({
    onSuccess: () => {
      void refetchGames();
      handleMenuClose();
    },
  });

  const handleOPDBGameSelect = (opdbId: string, gameData: OPDBSearchResult) => {
    setSelectedOPDBGame({ opdbId, gameData });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, gameId: string) => {
    setMenuAnchor(event.currentTarget);
    setSelectedGameId(gameId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedGameId(null);
  };

  const handleDeleteGame = () => {
    if (selectedGameId) {
      deleteGameTitle.mutate({ id: selectedGameId });
    }
  };

  const isDataStale = (lastSynced: Date | null): boolean => {
    if (!lastSynced) return true;
    const hoursAgo = (Date.now() - lastSynced.getTime()) / (1000 * 60 * 60);
    return hoursAgo > 24;
  };

  if (isLoadingGames) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: "center" }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading game titles...
        </Typography>
      </Container>
    );
  }

  if (gameError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading game titles: {gameError.message}
        </Alert>
      </Container>
    );
  }

  const gameTitleCount = gameTitles?.length ?? 0;
  const opdbGameCount = gameTitles?.filter(game => game.opdbId && !game.opdbId.startsWith('custom-')).length ?? 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          Game Title Management
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Manage your pinball machine database with OPDB integration
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={12}>
          <Card elevation={2}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h5" component="h2">
                  Add Game from OPDB
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Sync />}
                  onClick={() => syncWithOPDB.mutate()}
                  disabled={syncWithOPDB.isPending || opdbGameCount === 0}
                >
                  {syncWithOPDB.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    `Sync ${opdbGameCount} Games`
                  )}
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Search the Open Pinball Database to add new games to your collection.
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
                          opdbId: selectedOPDBGame.opdbId,
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
              
              {syncWithOPDB.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Sync failed: {syncWithOPDB.error.message}
                </Alert>
              )}
              
              {syncWithOPDB.data && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  {syncWithOPDB.data.message}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Game Collection ({gameTitleCount})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {opdbGameCount} from OPDB • {gameTitleCount - opdbGameCount} custom
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {gameTitleCount === 0 ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <Games sx={{ fontSize: 60, color: "text.disabled", mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No games in your collection
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use the search above to add games from OPDB
                  </Typography>
                </Box>
              ) : (
                <List>
                  {gameTitles?.map((game) => (
                    <ListItem
                      key={game.id}
                      sx={{
                        px: 0,
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          src={game.imageUrl ?? undefined}
                          sx={{ bgcolor: "primary.main", width: 56, height: 56 }}
                        >
                          {!game.imageUrl && <Games />}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="h6" component="span">
                              {game.name}
                            </Typography>
                            {game.opdbId && game.opdbId.startsWith('custom-') ? (
                              <Chip label="Custom" size="small" color="secondary" />
                            ) : (
                              <Chip 
                                label="OPDB" 
                                size="small" 
                                color="primary"
                                sx={{ 
                                  bgcolor: isDataStale(game.lastSynced) ? 'warning.main' : 'primary.main',
                                  color: 'white'
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            {game.manufacturer && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                <Business sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" color="text.secondary">
                                  {game.manufacturer}
                                </Typography>
                                {game.releaseDate && (
                                  <>
                                    <CalendarToday sx={{ fontSize: 16, color: "text.secondary", ml: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                      {game.releaseDate.getFullYear()}
                                    </Typography>
                                  </>
                                )}
                              </Box>
                            )}
                            {game.description && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ 
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {game.description}
                              </Typography>
                            )}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {game._count.gameInstances} instance{game._count.gameInstances !== 1 ? 's' : ''}
                              </Typography>
                              {game.lastSynced && (
                                <Typography variant="caption" color="text.secondary">
                                  • Synced {new Date(game.lastSynced).toLocaleDateString()}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, game.id)}
                        disabled={deleteGameTitle.isPending}
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
      </Grid>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteGame} sx={{ color: "error.main" }}>
          <Delete sx={{ mr: 1 }} />
          Delete Game Title
        </MenuItem>
      </Menu>
    </Container>
  );
}