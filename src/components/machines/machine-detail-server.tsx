/**
 * Machine Detail Server Component
 * Phase 3B: Server-rendered machine specifications and information
 */

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { 
  Wrench, 
  MapPin, 
  Hash,
  Clock
} from "lucide-react";

interface Machine {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  qr_code_url?: string | null;
  qr_code_generated_at?: Date | null;
  location?: {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
    street?: string | null;
  } | null;
  model?: {
    id: string;
    name: string;
    manufacturer?: string | null;
    year?: number | null;
    machine_type?: string | null;
    machine_display?: string | null;
  } | null;
}

interface MachineDetailServerProps {
  machine: Machine;
}

export function MachineDetailServer({ machine }: MachineDetailServerProps) {
  return (
    <div className="space-y-6">
      {/* Machine Specifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Machine Specifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-base">{machine.name || "Not specified"}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Manufacturer</label>
                <p className="text-base">{machine.model?.manufacturer || "Not specified"}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                <p className="text-base">{machine.model?.name || "Not specified"}</p>
              </div>
              
              {machine.model?.year && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Year</label>
                  <p className="text-base">{machine.model.year}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {machine.model?.machine_type && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <Badge variant="secondary">{machine.model.machine_type}</Badge>
                </div>
              )}
              
              {machine.model?.machine_display && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Display</label>
                  <p className="text-base">{machine.model.machine_display}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Machine ID</label>
                <p className="text-base font-mono text-sm">{machine.id}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {machine.location ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location Name</label>
                <p className="text-base">{machine.location.name}</p>
              </div>
              
              {machine.location.street && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-base">
                    {machine.location.street}
                    {(machine.location.city || machine.location.state) && (
                      <>
                        <br />
                        {[machine.location.city, machine.location.state]
                          .filter(Boolean)
                          .join(", ")}
                      </>
                    )}
                  </p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location ID</label>
                <p className="text-base font-mono text-sm">{machine.location.id}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No location assigned</p>
          )}
        </CardContent>
      </Card>

      {/* QR Code Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            QR Code Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base">
                {machine.qr_code_url ? "QR Code Generated" : "No QR Code"}
              </p>
              {machine.qr_code_generated_at && (
                <p className="text-sm text-muted-foreground">
                  Generated on {new Date(machine.qr_code_generated_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <Badge variant={machine.qr_code_url ? "default" : "secondary"}>
              {machine.qr_code_url ? "Active" : "Not Generated"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-base">
                {new Date(machine.created_at).toLocaleDateString()} at{" "}
                {new Date(machine.created_at).toLocaleTimeString()}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-base">
                {new Date(machine.updated_at).toLocaleDateString()} at{" "}
                {new Date(machine.updated_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}