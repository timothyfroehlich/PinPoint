/**
 * Material Design 3 Color Theme Generator
 *
 * Generates a complete Material Design 3 color palette from a purple source color
 * using Google's official Material Color Utilities with the 2025 specification.
 */

import type { Scheme } from "@material/material-color-utilities";
import {
  argbFromHex,
  themeFromSourceColor,
  hexFromArgb,
} from "@material/material-color-utilities";

export interface MaterialColors {
  // Primary color family
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  // Secondary color family
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  // Tertiary color family
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  // Error color family
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  // Surface color family (key for navigation backgrounds)
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceContainerLow: string;
  surfaceContainerLowest: string;

  // Additional colors
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  background: string;
  onBackground: string;
}

export interface MaterialTheme {
  light: MaterialColors;
  dark: MaterialColors;
}

/**
 * Convert Material Design 3 Scheme to our MaterialColors interface
 * Handles potential undefined properties gracefully
 */
function schemeToColors(scheme: Scheme): MaterialColors {
  return {
    primary: hexFromArgb(scheme.primary),
    onPrimary: hexFromArgb(scheme.onPrimary),
    primaryContainer: hexFromArgb(scheme.primaryContainer),
    onPrimaryContainer: hexFromArgb(scheme.onPrimaryContainer),

    secondary: hexFromArgb(scheme.secondary),
    onSecondary: hexFromArgb(scheme.onSecondary),
    secondaryContainer: hexFromArgb(scheme.secondaryContainer),
    onSecondaryContainer: hexFromArgb(scheme.onSecondaryContainer),

    tertiary: hexFromArgb(scheme.tertiary),
    onTertiary: hexFromArgb(scheme.onTertiary),
    tertiaryContainer: hexFromArgb(scheme.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(scheme.onTertiaryContainer),

    error: hexFromArgb(scheme.error),
    onError: hexFromArgb(scheme.onError),
    errorContainer: hexFromArgb(scheme.errorContainer),
    onErrorContainer: hexFromArgb(scheme.onErrorContainer),

    surface: hexFromArgb(scheme.surface),
    onSurface: hexFromArgb(scheme.onSurface),
    surfaceVariant: hexFromArgb(scheme.surfaceVariant),
    onSurfaceVariant: hexFromArgb(scheme.onSurfaceVariant),

    // Handle potentially undefined surface container properties
    // Fall back to computed alternatives if not available
    surfaceContainer: (scheme as any).surfaceContainer
      ? hexFromArgb((scheme as any).surfaceContainer)
      : hexFromArgb(scheme.surface), // fallback
    surfaceContainerHigh: (scheme as any).surfaceContainerHigh
      ? hexFromArgb((scheme as any).surfaceContainerHigh)
      : hexFromArgb(scheme.surfaceVariant), // fallback
    surfaceContainerHighest: (scheme as any).surfaceContainerHighest
      ? hexFromArgb((scheme as any).surfaceContainerHighest)
      : hexFromArgb(scheme.surfaceVariant), // fallback
    surfaceContainerLow: (scheme as any).surfaceContainerLow
      ? hexFromArgb((scheme as any).surfaceContainerLow)
      : hexFromArgb(scheme.surface), // fallback
    surfaceContainerLowest: (scheme as any).surfaceContainerLowest
      ? hexFromArgb((scheme as any).surfaceContainerLowest)
      : hexFromArgb(scheme.surface), // fallback

    outline: hexFromArgb(scheme.outline),
    outlineVariant: hexFromArgb(scheme.outlineVariant),
    shadow: hexFromArgb(scheme.shadow),
    scrim: hexFromArgb(scheme.scrim),
    inverseSurface: hexFromArgb(scheme.inverseSurface),
    inverseOnSurface: hexFromArgb(scheme.inverseOnSurface),
    inversePrimary: hexFromArgb(scheme.inversePrimary),
    background: hexFromArgb(scheme.background),
    onBackground: hexFromArgb(scheme.onBackground),
  };
}

/**
 * Generate Material Design 3 theme from a source color
 *
 * @param sourceColorHex - Source color in hex format (e.g., '#6750A4')
 * @returns Complete Material Design 3 theme with light and dark variants
 */
export function generateMaterialTheme(sourceColorHex: string): MaterialTheme {
  // Convert hex to ARGB format required by Material Color Utilities
  const sourceColorArgb = argbFromHex(sourceColorHex);

  // Generate theme using Material Design 3 algorithms
  const theme = themeFromSourceColor(sourceColorArgb);

  return {
    light: schemeToColors(theme.schemes.light),
    dark: schemeToColors(theme.schemes.dark),
  };
}

/**
 * Convert hex color to HSL format for CSS variables
 *
 * @param hex - Hex color (e.g., '#6750A4')
 * @returns HSL string without hsl() wrapper (e.g., '247 53% 70%')
 */
export function hexToHslString(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Find min, max, and delta
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  // Calculate lightness
  const l = (max + min) / 2;

  // Calculate saturation
  let s = 0;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  }

  // Calculate hue
  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  // Convert to percentages and round
  const hslH = Math.round(h);
  const hslS = Math.round(s * 100);
  const hslL = Math.round(l * 100);

  return `${String(hslH)} ${String(hslS)}% ${String(hslL)}%`;
}

/**
 * Generate CSS custom properties for the Material theme
 *
 * @param theme - Material theme generated from generateMaterialTheme
 * @returns CSS custom properties as strings
 */
export function generateCssCustomProperties(theme: MaterialTheme) {
  const lightTheme = Object.entries(theme.light)
    .map(
      ([key, value]) =>
        `  --${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${hexToHslString(value)};`,
    )
    .join("\n");

  const darkTheme = Object.entries(theme.dark)
    .map(
      ([key, value]) =>
        `  --${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${hexToHslString(value)};`,
    )
    .join("\n");

  return {
    light: lightTheme,
    dark: darkTheme,
  };
}

// PinPoint-specific purple source color (similar to current primary but optimized for Material 3)
export const PINPOINT_PURPLE_SOURCE = "#6750A4"; // Material Design signature purple

// Generate the PinPoint Material theme
export const pinpointMaterialTheme = generateMaterialTheme(
  PINPOINT_PURPLE_SOURCE,
);

// Log the generated theme for development purposes
if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
  console.log("🎨 Generated PinPoint Material Design 3 Theme:", {
    source: PINPOINT_PURPLE_SOURCE,
    lightSurface: pinpointMaterialTheme.light.surface,
    lightOnSurface: pinpointMaterialTheme.light.onSurface,
    lightSurfaceContainer: pinpointMaterialTheme.light.surfaceContainer,
    lightPrimary: pinpointMaterialTheme.light.primary,
  });
}
