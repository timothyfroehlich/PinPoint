import { Paper, Typography } from "@mui/material";

export default function SettingsPage(): React.JSX.Element {
  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Typography variant="body1" color="text.secondary">
        Welcome to the settings area. Use the navigation on the left to manage
        different aspects of your organization.
      </Typography>
    </Paper>
  );
}
