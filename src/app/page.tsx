"use client";

import { Container, Typography, Card, CardContent, Chip, Box, Paper, CircularProgress } from "@mui/material";
import { api } from "~/trpc/react";

export default function Home() {
  const { data: gameTitles, isLoading, error } = api.gameTitle.getAll.useQuery();

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
        <Typography variant="h4" color="error">
          Error loading game titles: {error.message}
        </Typography>
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
          Game Title Database Status
        </Typography>
      </Box>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h5" component="h2">
              Database Summary
            </Typography>
            <Chip 
              label={`${gameTitleCount} game titles`} 
              color="primary" 
              variant="outlined"
            />
          </Box>
          
          {gameTitleCount > 0 ? (
            <Typography variant="body1" color="text.secondary">
              Found {gameTitleCount} game title{gameTitleCount !== 1 ? 's' : ''} in the database
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No game titles found in the database yet
            </Typography>
          )}
        </CardContent>
      </Card>

      {gameTitleCount > 0 && gameTitles && (
        <Card elevation={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Raw Game Title Data
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
                {JSON.stringify(gameTitles, null, 2)}
              </Typography>
            </Paper>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}