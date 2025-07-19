"use client";

import { Modal, Card, Typography, TextField, Button, Box } from "@mui/material";

interface LoginModalProps {
  onLogin: () => void;
}

const LoginModal = ({ onLogin }: LoginModalProps): JSX.Element => {
  return (
    <Modal
      open={true}
      aria-labelledby="login-modal-title"
      aria-describedby="login-modal-description"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Card sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Typography
          id="login-modal-title"
          variant="h5"
          component="h2"
          gutterBottom
        >
          Welcome to PinPoint
        </Typography>
        <Typography id="login-modal-description" sx={{ mb: 2 }}>
          Enter your email to receive a magic link.
        </Typography>
        <Box component="form" noValidate autoComplete="off">
          <TextField
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 1 }}
            onClick={onLogin}
          >
            Continue with Email
          </Button>
        </Box>
      </Card>
    </Modal>
  );
};

export default LoginModal;
