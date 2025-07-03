"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Container,
  Paper,
  CircularProgress,
} from "@mui/material";
import { login } from "~/app/login/actions";

function LoginButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      fullWidth
      variant="contained"
      sx={{ mt: 3, mb: 2 }}
      disabled={pending}
    >
      {pending ? <CircularProgress size={24} /> : "Sign In"}
    </Button>
  );
}

export function LoginForm() {
  const [errorMessage, dispatch] = useFormState(login, undefined);

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ mt: 8, p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" action={dispatch} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
          />
          {errorMessage && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {errorMessage}
            </Alert>
          )}
          <LoginButton />
        </Box>
      </Paper>
    </Container>
  );
}
