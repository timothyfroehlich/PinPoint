import { Card, Typography, Box } from "@mui/material";
import Link from "next/link";

import { PermissionGate } from "~/components/permissions";

type IssueStatus = "new" | "in progress" | "acknowledged" | "resolved";
type IssuePriority = "high" | "medium" | "low";

interface DetailedIssueCardProps {
  id: string;
  title: string;
  machineName: string;
  status: IssueStatus;
  priority: IssuePriority;
  hasPermission?: (permission: string) => boolean;
}

const getStatusColor = (status: IssueStatus): string => {
  switch (status) {
    case "new":
      return "#60a5fa"; // Blue
    case "in progress":
      return "#60a5fa"; // Blue
    case "acknowledged":
      return "#fbbf24"; // Yellow
    case "resolved":
      return "#10b981"; // Green
    default:
      return "#a0aec0"; // Gray
  }
};

const getPriorityBorderColor = (priority: IssuePriority): string => {
  switch (priority) {
    case "high":
      return "#f87171"; // Red
    case "medium":
      return "#fbbf24"; // Yellow
    case "low":
      return "#6b7280"; // Gray
    default:
      return "#6b7280"; // Gray
  }
};

const DetailedIssueCard = ({
  id,
  title,
  machineName,
  status,
  priority,
  hasPermission = () => true,
}: DetailedIssueCardProps): React.ReactElement => {
  const cardContent = (
    <Card
      sx={{
        p: 3,
        mb: 2,
        borderLeft: 4,
        borderColor: getPriorityBorderColor(priority),
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.08)",
        },
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight="medium" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {machineName}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: getStatusColor(status),
          fontWeight: "medium",
          textTransform: "lowercase",
        }}
      >
        {status}
      </Typography>
    </Card>
  );

  return (
    <PermissionGate permission="issue:view" hasPermission={hasPermission}>
      <Link href={`/issues/${id}`} passHref style={{ textDecoration: "none" }}>
        {cardContent}
      </Link>
    </PermissionGate>
  );
};

export default DetailedIssueCard;
