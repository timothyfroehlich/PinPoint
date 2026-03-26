"use client";

import type React from "react";
import { useState, useTransition, useEffect, useCallback } from "react";
import { RefreshCw, Search, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  getPbmSyncReportAction,
  addToPinballMapAction,
  removeFromPinballMapAction,
} from "~/app/(app)/m/pinball-map-actions";
import type {
  PbmSyncReport,
  PbmSyncEntry,
  PbmSyncStatus,
} from "~/lib/pinball-map/types";
import { getMachinePresenceLabel } from "~/lib/machines/presence";
import Link from "next/link";

const STATUS_LABELS: Record<PbmSyncStatus, string> = {
  in_sync: "In Sync",
  missing_from_pbm: "Missing from PBM",
  extra_on_pbm: "Extra on PBM",
  not_linked: "Not Linked",
};

const STATUS_STYLES: Record<PbmSyncStatus, string> = {
  in_sync: "bg-green-600/20 text-green-400 border-green-600/30",
  missing_from_pbm: "bg-amber-600/20 text-amber-400 border-amber-600/30",
  extra_on_pbm: "bg-red-600/20 text-red-400 border-red-600/30",
  not_linked: "bg-muted text-muted-foreground",
};

export function SyncTable(): React.JSX.Element {
  const [report, setReport] = useState<PbmSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMachineId, setActionMachineId] = useState<string | null>(null);

  const loadReport = useCallback((): void => {
    startLoading(async () => {
      const result = await getPbmSyncReportAction();
      if (result.ok) {
        setReport(result.value);
        setError(null);
      } else {
        setError(result.message);
        setReport(null);
      }
    });
  }, []);

  // Load on mount
  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleAdd = (entry: PbmSyncEntry): void => {
    setActionMachineId(entry.machineId);
    void addToPinballMapAction(entry.machineId).then((result) => {
      setActionMachineId(null);
      if (result.ok) {
        toast.success(`Added ${entry.machineName} to Pinball Map`);
        loadReport();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleRemove = (entry: PbmSyncEntry): void => {
    setActionMachineId(entry.machineId);
    void removeFromPinballMapAction(entry.machineId).then((result) => {
      setActionMachineId(null);
      if (result.ok) {
        toast.success(`Removed ${entry.machineName} from Pinball Map`);
        loadReport();
      } else {
        toast.error(result.message);
      }
    });
  };

  const filteredEntries =
    report?.entries.filter(
      (e) =>
        e.machineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.machineInitials.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.pbmMachineName ?? "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    ) ?? [];

  return (
    <div className="space-y-4">
      {/* Summary + Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search machines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadReport}
          disabled={isLoading}
        >
          <RefreshCw
            className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Summary badges */}
      {report && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={STATUS_STYLES.in_sync}>
            {report.summary.inSync} In Sync
          </Badge>
          <Badge variant="outline" className={STATUS_STYLES.missing_from_pbm}>
            {report.summary.missingFromPbm} Missing from PBM
          </Badge>
          <Badge variant="outline" className={STATUS_STYLES.extra_on_pbm}>
            {report.summary.extraOnPbm} Extra on PBM
          </Badge>
          <Badge variant="outline" className={STATUS_STYLES.not_linked}>
            {report.summary.notLinked} Not Linked
          </Badge>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !report && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading sync status...
          </span>
        </div>
      )}

      {/* Table */}
      {report && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>PBM Model</TableHead>
                <TableHead>Floor Status</TableHead>
                <TableHead>PBM Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {searchQuery
                      ? "No machines match your search."
                      : "No machines found."}
                  </TableCell>
                </TableRow>
              )}
              {filteredEntries.map((entry) => (
                <TableRow key={entry.machineId}>
                  <TableCell>
                    <Link
                      href={`/m/${entry.machineInitials}`}
                      className="hover:underline"
                    >
                      <span className="font-medium">{entry.machineName}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({entry.machineInitials})
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.pbmMachineName ?? (
                      <span className="text-muted-foreground italic">
                        Not linked
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {getMachinePresenceLabel(entry.presenceStatus)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES[entry.syncStatus]}
                    >
                      {STATUS_LABELS[entry.syncStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {entry.syncStatus === "missing_from_pbm" &&
                        entry.pbmMachineId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => handleAdd(entry)}
                            disabled={actionMachineId === entry.machineId}
                            title="Add to Pinball Map"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        )}
                      {entry.syncStatus === "extra_on_pbm" &&
                        entry.pbmLocationMachineXrefId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => handleRemove(entry)}
                            disabled={actionMachineId === entry.machineId}
                            title="Remove from Pinball Map"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      {entry.syncStatus === "not_linked" && (
                        <Link href={`/m/${entry.machineInitials}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Link machine"
                          >
                            <Unlink className="size-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {/* Extra machines on PBM not in PinPoint */}
              {report.extraOnPbm.map((extra) => (
                <TableRow key={`extra-${extra.xrefId}`}>
                  <TableCell>
                    <span className="text-muted-foreground italic">
                      Not in PinPoint
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {extra.name}
                    {extra.manufacturer && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({extra.manufacturer})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_STYLES.extra_on_pbm}
                    >
                      Extra on PBM
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      Remove via PBM
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
