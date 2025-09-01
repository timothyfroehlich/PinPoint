/**
 * Machine Header Server Component
 * Phase 3B: Server-rendered machine header with metadata and breadcrumbs
 */

import Link from "next/link";
import { ArrowLeft, MapPin, Wrench, Calendar } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";

interface Machine {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  location?: {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
  } | null;
  model?: {
    id: string;
    name: string;
    manufacturer?: string | null;
    year?: number | null;
  } | null;
}

interface MachineHeaderProps {
  machine: Machine;
}

export function MachineHeader({ machine }: MachineHeaderProps) {
  const displayName = machine.name;
  const locationName = machine.location.name;
  const modelInfo = machine.model
    ? `${machine.model.manufacturer ?? ""} ${machine.model.name}`.trim()
    : "Unknown Model";

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/machines" className="flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back to Machines
          </Link>
        </Button>
      </div>

      {/* Machine Header Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold">
                {displayName}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Wrench className="h-4 w-4" />
                  {modelInfo}
                  {machine.model?.year && (
                    <span className="text-muted-foreground">
                      ({machine.model.year})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {locationName}
                  {machine.location.city && machine.location.state && (
                    <span className="text-muted-foreground">
                      - {machine.location.city}, {machine.location.state}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Added {new Date(machine.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">Active</Badge>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/machines/${machine.id}/edit`}>Edit Machine</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
