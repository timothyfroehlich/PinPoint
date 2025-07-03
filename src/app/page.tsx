"use client";

import { Container, Typography, Card, CardContent, Chip, Box, Paper, CircularProgress } from "@mui/material";
import { api } from "~/trpc/react";

export default function Home() {
  const { data: games, isLoading, error } = api.game.getAll.useQuery();

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading games...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h4" color="error">
          Error loading games: {error.message}
        </Typography>
      </Container>
    );
  }

  const gameCount = games?.length || 0;
  
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          PinPoint
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Game Database Status
        </Typography>
      </Box>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h5" component="h2">
              Database Summary
            </Typography>
            <Chip 
              label={`${gameCount} games`} 
              color="primary" 
              variant="outlined"
            />
          </Box>
          
          {gameCount > 0 ? (
            <Typography variant="body1" color="text.secondary">
              Found {gameCount} game{gameCount !== 1 ? 's' : ''} in the database
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No games found in the database yet
            </Typography>
          )}
        </CardContent>
      </Card>

      {gameCount > 0 && games && (
        <Card elevation={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Raw Game Data
            </Typography>
            <Paper 
              sx={{ 
                p: 2, 
                backgroundColor: 'grey.50',
                overflow: 'auto',
                maxHeight: 400
              }}
            >
              <Typography 
                component="pre" 
                variant="body2" 
                sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre-wrap',
                  margin: 0
                }}
              >
                {JSON.stringify(games, null, 2)}
              </Typography>
            </Paper>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}