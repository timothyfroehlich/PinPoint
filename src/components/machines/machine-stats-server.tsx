/**
 * Machine Statistics Server Component
 * Phase 3B: Organization-level machine analytics with Server Component rendering
 */

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { MonitorIcon, MapPinIcon, CogIcon, QrCodeIcon } from "lucide-react";
import type { MachineStats } from "~/lib/dal/machines";

interface MachineStatsServerProps {
  stats: MachineStats;
}

export function MachineStatsServer({
  stats,
}: MachineStatsServerProps): JSX.Element {
  const qrPercentage =
    stats.total > 0 ? Math.round((stats.withQR / stats.total) * 100) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Machines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
          <MonitorIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.total.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Active pinball machines
          </p>
        </CardContent>
      </Card>

      {/* QR Code Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            QR Code Coverage
          </CardTitle>
          <QrCodeIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{qrPercentage}%</div>
            <Badge
              variant={
                qrPercentage >= 80
                  ? "secondary"
                  : qrPercentage >= 50
                    ? "outline"
                    : "secondary"
              }
            >
              {stats.withQR}/{stats.total}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Machines with QR codes
          </p>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Locations</CardTitle>
          <MapPinIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.byLocation.length}</div>
          <p className="text-xs text-muted-foreground">Active locations</p>
          {stats.byLocation.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">Top location:</div>
              <div className="text-xs font-medium truncate">
                {stats.byLocation[0]?.locationName} (
                {stats.byLocation[0]?.count} machines)
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Machine Models */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Machine Models</CardTitle>
          <CogIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.byModel.length}</div>
          <p className="text-xs text-muted-foreground">Unique models</p>
          {stats.byModel.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-muted-foreground">Most common:</div>
              <div className="text-xs font-medium truncate">
                {stats.byModel[0]?.modelName} ({stats.byModel[0]?.count})
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
