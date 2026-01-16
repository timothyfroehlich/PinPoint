"use client";

import { Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { useState, useEffect } from "react";
import type React from "react";
import { puckConfig } from "~/lib/puck/config";
import type { Data } from "@puckeditor/core";

/**
 * Client-side Puck renderer component for previewing prototypes.
 * Renders the saved Puck data without the editor interface.
 */
export function PuckRenderer(): React.JSX.Element {
  const [data, setData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from localStorage on mount
  useEffect((): void => {
    const savedData = window.localStorage.getItem("puck-prototype-data");
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData) as Data;
        setData(parsedData);
      } catch (error) {
        console.error("Failed to parse saved Puck data:", error);
      }
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading preview...</div>
      </div>
    );
  }

  if (!data?.content || data.content.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg font-semibold">No prototype data found</div>
        <p className="text-muted-foreground">
          Create a prototype in the{" "}
          <a href="/debug/puck" className="text-primary hover:underline">
            Puck editor
          </a>{" "}
          first.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <Render config={puckConfig} data={data} />
      </div>
    </div>
  );
}
