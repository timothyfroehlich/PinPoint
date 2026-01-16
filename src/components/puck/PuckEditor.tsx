"use client";

import { Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { useState, useEffect } from "react";
import type React from "react";
import { toast } from "sonner";
import { puckConfig } from "~/lib/puck/config";
import type { Data } from "@puckeditor/core";

/**
 * Client-side Puck editor component for UX prototyping.
 * Only available in development mode.
 * 
 * Uses localStorage for persistence during prototyping sessions.
 */
export function PuckEditor(): React.JSX.Element {
  const [data, setData] = useState<Data>({ content: [], root: {} });
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

  const handlePublish = (newData: Data): void => {
    // Save to localStorage
    window.localStorage.setItem("puck-prototype-data", JSON.stringify(newData));
    setData(newData);
    
    // Show success notification
    toast.success("Prototype saved successfully!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <Puck
        config={puckConfig}
        data={data}
        onPublish={handlePublish}
      />
    </div>
  );
}
