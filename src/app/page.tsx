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
  Divider
} from "@mui/material";
import { useState } from "react";
import { api } from "~/trpc/react";

export default function Home() {
  const [newGameName, setNewGameName] = useState("");
  
  const { 
    data: gameTitles, 
    isLoading, 
    error,
    refetch 
  } = api.gameTitle.getAll.useQuery();
  
  const createGameTitle = api.gameTitle.create.useMutation({
    onSuccess: () => {
      setNewGameName("");
      void refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGameName.trim()) {
      createGameTitle.mutate({ name: newGameName.trim() });
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading game titles...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading game titles: {error.message}
        </Alert>
      </Container>
    );
  }

  const gameTitleCount = gameTitles?.length ?? 0;
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          PinPoint
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Game Management
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Add New Game Form */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Add New Game
              </Typography>
              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
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
                  {createGameTitle.isPending ? <CircularProgress size={24} /> : 'Add'}
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

        {/* Game List */}
        <Grid item xs={12}>
          <Card elevation={1}>
            <CardContent>
              <Typography variant="h5" component="h2" gutterBottom>
                Game Titles ({gameTitleCount})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {gameTitleCount === 0 ? (
                <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No games added yet. Use the form above to add your first game!
                </Typography>
              ) : (
                <List>
                  {gameTitles?.map((game) => (
                    <ListItem key={game.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={game.name}
                        secondary={`Added: ${new Date(game.id.slice(0, 8)).toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}