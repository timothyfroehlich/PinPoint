import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  WrenchIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "lucide-react";

interface DashboardStatsProps {
  stats: {
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    totalMachines: number;
    inProgressIssues?: number;
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const resolutionRate =
    stats.totalIssues > 0
      ? Math.round((stats.closedIssues / stats.totalIssues) * 100)
      : 0;

  const inProgressIssues =
    stats.inProgressIssues ??
    stats.totalIssues - stats.openIssues - stats.closedIssues;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Open Issues"
        value={stats.openIssues}
        icon={<AlertCircleIcon className="h-4 w-4" />}
        description="Requires attention"
        trend={stats.openIssues > 0 ? "needs-attention" : "good"}
      />

      <StatCard
        title="In Progress"
        value={inProgressIssues}
        icon={<ClockIcon className="h-4 w-4" />}
        description="Being worked on"
        trend="neutral"
      />

      <StatCard
        title="Resolution Rate"
        value={`${resolutionRate}%`}
        icon={<CheckCircleIcon className="h-4 w-4" />}
        description="Issues resolved"
        trend={
          resolutionRate >= 80
            ? "good"
            : resolutionRate >= 60
              ? "neutral"
              : "needs-attention"
        }
      />

      <StatCard
        title="Total Machines"
        value={stats.totalMachines}
        icon={<WrenchIcon className="h-4 w-4" />}
        description="In your inventory"
        trend="neutral"
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend: "good" | "neutral" | "needs-attention";
}

function StatCard({ title, value, icon, description, trend }: StatCardProps) {
  const trendColors = {
    good: "text-green-600",
    neutral: "text-blue-600",
    "needs-attention": "text-red-600",
  };

  const bgColors = {
    good: "bg-green-50",
    neutral: "bg-blue-50",
    "needs-attention": "bg-red-50",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${bgColors[trend]}`}>
          <div className={trendColors[trend]}>{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
