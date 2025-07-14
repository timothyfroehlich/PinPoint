"use client";

import SettingsIcon from "@mui/icons-material/Settings";
import { Toolbar, Typography, Button, Box } from "@mui/material";

const SecondaryHeader = () => {
  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography variant="h5" fontWeight="bold">
          Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          sx={{
            borderColor: "rgba(255,255,255,0.3)",
            color: "text.secondary",
            textTransform: "none",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.5)",
              bgcolor: "rgba(255,255,255,0.05)",
            },
          }}
        >
          Customize
        </Button>
      </Toolbar>
    </Box>
  );
};

export default SecondaryHeader;
