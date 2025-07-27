"use client";

import { Edit } from "@mui/icons-material";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

interface User {
  id: string;
  name: string | null;
  email: string;
  profilePicture: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
}

interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (userId: string) => void;
  onSuccess: (message: string) => void;
}

export function UserTable({
  users,
  loading,
  onEdit,
}: UserTableProps): React.JSX.Element {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>User</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Current Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Avatar
                    {...(user.profilePicture && { src: user.profilePicture })}
                    sx={{ width: 40, height: 40 }}
                  >
                    {user.name?.[0]?.toUpperCase() ??
                      user.email[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="body1" fontWeight="medium">
                    {user.name ?? user.email}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {user.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={user.role.name}
                  variant={user.role.isSystem ? "filled" : "outlined"}
                  color={user.role.isSystem ? "primary" : "default"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={user.emailVerified ? "Verified" : "Pending"}
                  color={user.emailVerified ? "success" : "warning"}
                  variant="outlined"
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  onClick={() => {
                    onEdit(user.id);
                  }}
                  title="Edit"
                >
                  <Edit />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
