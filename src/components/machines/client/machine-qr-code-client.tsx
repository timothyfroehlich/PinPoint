/**
 * Machine QR Code Management Client Island
 * Phase 3B: QR code operations with download and regeneration
 * Client Component for interactive QR code management
 */

"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import {
  DownloadIcon,
  RefreshCwIcon,
  QrCodeIcon,
  MoreVerticalIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { regenerateQRCodeAction } from "~/lib/actions/machine-actions";

interface MachineQRCodeClientProps {
  machineId: string;
  qrCodeUrl?: string | null;
  qrCodeGeneratedAt?: Date | null;
  machineName: string;
  showBulkActions?: boolean;
}

export function MachineQRCodeClient({
  machineId,
  qrCodeUrl,
  qrCodeGeneratedAt,
  machineName,
  showBulkActions: _showBulkActions = false,
}: MachineQRCodeClientProps) {
  const [currentQRCode, setCurrentQRCode] = useState(qrCodeUrl);
  const [generatedAt, setGeneratedAt] = useState(qrCodeGeneratedAt);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleRegenerate = () => {
    startTransition(async () => {
      try {
        const result = await regenerateQRCodeAction(machineId);

        if (result.success) {
          setCurrentQRCode(result.data.qrCodeUrl);
          setGeneratedAt(new Date());
          setMessage({
            type: "success",
            text: "QR code regenerated successfully",
          });

          // Clear success message after 3 seconds
          setTimeout(() => {
            setMessage(null);
          }, 3000);
        } else {
          setMessage({
            type: "error",
            text: result.error || "Failed to regenerate QR code",
          });
        }
      } catch (error) {
        setMessage({ type: "error", text: "An unexpected error occurred" });
      }
    });
  };

  const handleDownload = () => {
    if (!currentQRCode) return;

    try {
      // Create download link
      const link = document.createElement("a");
      link.href = currentQRCode;
      link.download = `${machineName.replace(/[^a-zA-Z0-9]/g, "_")}_QR_Code.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage({ type: "success", text: "QR code downloaded" });
      setTimeout(() => {
        setMessage(null);
      }, 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to download QR code" });
    }
  };

  const handlePrint = () => {
    if (!currentQRCode) return;

    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code - ${machineName}</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  text-align: center; 
                  padding: 20px; 
                }
                .qr-container { 
                  margin: 20px auto; 
                  max-width: 400px; 
                }
                .qr-code { 
                  max-width: 100%; 
                  height: auto; 
                  border: 1px solid #ddd; 
                  padding: 20px;
                  background: white;
                }
                .machine-name { 
                  font-size: 18px; 
                  font-weight: bold; 
                  margin-bottom: 10px; 
                }
                .generated-date { 
                  font-size: 12px; 
                  color: #666; 
                  margin-top: 10px; 
                }
                @media print {
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>
              <div class="qr-container">
                <div class="machine-name">${machineName}</div>
                <img src="${currentQRCode}" alt="QR Code for ${machineName}" class="qr-code" />
                ${generatedAt ? `<div class="generated-date">Generated: ${generatedAt.toLocaleDateString()}</div>` : ""}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();

        setMessage({ type: "success", text: "QR code sent to printer" });
        setTimeout(() => {
          setMessage(null);
        }, 2000);
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to print QR code" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="h-5 w-5" />
            QR Code
          </div>

          {currentQRCode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isPending}>
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownload}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrint}>
                  <QrCodeIcon className="h-4 w-4 mr-2" />
                  Print QR Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleRegenerate}
                  disabled={isPending}
                >
                  <RefreshCwIcon
                    className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-2 rounded-md text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {currentQRCode ? (
          <>
            {/* QR Code Display */}
            <div className="flex justify-center">
              <div className="p-4 border rounded-lg bg-white">
                <img
                  src={currentQRCode}
                  alt={`QR Code for ${machineName}`}
                  className="w-32 h-32 object-contain"
                />
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="gap-1">
                <QrCodeIcon className="h-3 w-3" />
                Active QR Code
              </Badge>
            </div>

            {/* Generation Info */}
            {generatedAt && (
              <p className="text-xs text-center text-muted-foreground">
                Generated on {generatedAt.toLocaleDateString()} at{" "}
                {generatedAt.toLocaleTimeString()}
              </p>
            )}

            {/* Primary Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex-1"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex-1"
              >
                <RefreshCwIcon
                  className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
                />
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* No QR Code State */}
            <div className="flex justify-center items-center h-32 border rounded-lg bg-muted/50">
              <div className="text-center text-muted-foreground">
                <QrCodeIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No QR Code Generated</p>
                <p className="text-xs">
                  Generate a QR code for issue reporting
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="gap-1">
                <XIcon className="h-3 w-3" />
                Not Generated
              </Badge>
            </div>

            {/* Generate Action */}
            <Button
              onClick={handleRegenerate}
              disabled={isPending}
              className="w-full"
              size="sm"
            >
              <QrCodeIcon
                className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
              />
              Generate QR Code
            </Button>
          </>
        )}

        {/* Info Text */}
        <p className="text-xs text-center text-muted-foreground">
          QR code links to the issue reporting form for this machine
        </p>
      </CardContent>
    </Card>
  );
}
