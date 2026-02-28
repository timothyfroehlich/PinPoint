"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { CopyButton } from "~/components/ui/copy-button";
import { QrCode, Download, Printer, ExternalLink } from "lucide-react";

interface QrCodeDialogProps {
  machineName: string;
  machineInitials: string;
  qrDataUrl: string;
  reportUrl: string;
}

export function QrCodeDialog({
  machineName,
  machineInitials,
  qrDataUrl,
  reportUrl,
  trigger,
}: QrCodeDialogProps & { trigger?: React.ReactNode }): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <QrCode className="size-4" />
            Show QR Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            Machine Report QR
          </DialogTitle>
          <DialogDescription>
            Scan to instantly report issues for {machineName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* QR Card Visual */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-outline-variant/60">
            <img
              src={qrDataUrl}
              alt={`QR code for ${machineName} issue reporting`}
              className="size-48"
            />
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <Button variant="default" className="w-full shadow-sm" asChild>
              <a href={qrDataUrl} download={`${machineInitials}-qr.png`}>
                <Download className="mr-2 size-4" />
                Download Sticker PNG
              </a>
            </Button>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Printer className="size-4 text-on-surface-variant/50" />
                </div>
                <CopyButton
                  value={reportUrl}
                  variant="outline"
                  className="w-full justify-start pl-10 pr-2 font-mono text-xs text-on-surface-variant hover:text-on-surface border-dashed"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                asChild
                title="Test Link"
                aria-label="Open report link in new tab"
                className="shrink-0"
              >
                <a href={reportUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>

            <p className="text-[10px] text-center text-on-surface-variant/70 pt-2">
              Optimized for standard 2&quot;x2&quot; or larger label printers.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
