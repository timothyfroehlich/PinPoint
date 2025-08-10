import { createTheme } from "@mui/material/styles";

// Create a theme instance matching the PinPoint target design
const theme = createTheme({
  palette: {
    // Remove mode to prevent colorScheme script injection that causes hydration mismatch in CI
    primary: {
      main: "#667eea", // Purple-blue for primary actions and user avatar
    },
    secondary: {
      main: "#a8b4f0", // Lighter purple for secondary elements
    },
    error: {
      main: "#f87171", // Red border for high priority issues
    },
    warning: {
      main: "#fbbf24", // Yellow border for acknowledged issues
    },
    success: {
      main: "#10b981", // Green for resolved status
    },
    info: {
      main: "#60a5fa", // Blue for in progress status
    },
    background: {
      default: "#1a1a2e", // Dark navy background
      paper: "#2d3748", // Darker blue-grey for cards
    },
    text: {
      primary: "#ffffff",
      secondary: "#a0aec0",
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#2d3748",
          border: "none",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#2d3748",
          boxShadow: "none",
          borderBottom: "1px solid #4a5568",
        },
      },
    },
  },
});

export default theme;
