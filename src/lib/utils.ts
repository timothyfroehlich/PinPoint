import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility for conditional styling with MUI coexistence
export function muiToTailwind(_muiStyles: Record<string, any>) {
  // Helper to convert MUI sx props to Tailwind classes
  // Implementation for gradual migration
  return "";
}

// Design system bridge utilities
export const spacing = {
  xs: "0.5rem",
  sm: "0.75rem", 
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
} as const;

export const colors = {
  // Map your existing MUI theme colors to Tailwind variables
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  error: "hsl(var(--destructive))",
  warning: "hsl(var(--warning))",
  info: "hsl(var(--info))",
  success: "hsl(var(--success))",
} as const;