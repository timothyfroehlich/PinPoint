#!/usr/bin/env tsx
/**
 * Generate Pure Material Design 3 CSS custom properties for PinPoint
 * Uses only Material Design 3 generated colors without manual overrides
 * Run with: npx tsx scripts/generate-pure-material-css.ts
 */

import {
  generateMaterialTheme,
  generateCssCustomProperties,
  PINPOINT_PURPLE_SOURCE,
} from "../src/lib/colors/material-theme-generator.js";

console.log("🎨 Generating Pure Material Design 3 CSS for PinPoint\n");

// Generate the theme using Material Design 3 algorithms only
const theme = generateMaterialTheme(PINPOINT_PURPLE_SOURCE);

// Generate CSS custom properties
const cssProps = generateCssCustomProperties(theme);

console.log("🌅 Light Theme Material Colors:");
console.log(`  Primary: ${theme.light.primary}`);
console.log(`  Surface: ${theme.light.surface}`);
console.log(`  Surface Variant: ${theme.light.surfaceVariant}`);
console.log(`  Primary Container: ${theme.light.primaryContainer}`);
console.log(`  Secondary Container: ${theme.light.secondaryContainer}`);
console.log("");

const lightThemeCSS = `
/* === Pure Material Design 3 Light Theme === */
:root {
  /* Material Design 3 Generated Colors - Primary Family */
  --primary: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--primary:"))
      ?.split(": ")[1] ?? "256 34% 48%"
  };
  --on-primary: ${
    cssProps.light
      .split("\n")
      .find(
        (line) => line.includes("--on-primary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "0 0% 100%"
  };
  --primary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--primary-container:"))
      ?.split(": ")[1] || "261 100% 93%"
  };
  --on-primary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-primary-container:"))
      ?.split(": ")[1] || "262 100% 18%"
  };
  
  /* Material Design 3 Generated Colors - Secondary Family */
  --secondary: ${
    cssProps.light
      .split("\n")
      .find(
        (line) => line.includes("--secondary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "259 11% 40%"
  };
  --on-secondary: ${
    cssProps.light
      .split("\n")
      .find(
        (line) =>
          line.includes("--on-secondary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "0 0% 100%"
  };
  --secondary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--secondary-container:"))
      ?.split(": ")[1] || "263 65% 92%"
  };
  --on-secondary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-secondary-container:"))
      ?.split(": ")[1] || "257 26% 13%"
  };
  
  /* Material Design 3 Generated Colors - Tertiary Family */
  --tertiary: ${
    cssProps.light
      .split("\n")
      .find(
        (line) => line.includes("--tertiary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "341 21% 41%"
  };
  --on-tertiary: ${
    cssProps.light
      .split("\n")
      .find(
        (line) =>
          line.includes("--on-tertiary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "0 0% 100%"
  };
  --tertiary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--tertiary-container:"))
      ?.split(": ")[1] || "345 63% 91%"
  };
  --on-tertiary-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-tertiary-container:"))
      ?.split(": ")[1] || "342 43% 12%"
  };
  
  /* Material Design 3 Generated Colors - Surface Family */
  --surface: ${
    cssProps.light
      .split("\n")
      .find(
        (line) =>
          line.includes("--surface:") &&
          !line.includes("variant") &&
          !line.includes("container"),
      )
      ?.split(": ")[1] || "340 100% 99%"
  };
  --on-surface: ${
    cssProps.light
      .split("\n")
      .find(
        (line) => line.includes("--on-surface:") && !line.includes("variant"),
      )
      ?.split(": ")[1] || "236 13% 12%"
  };
  --surface-variant: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--surface-variant:"))
      ?.split(": ")[1] || "260 7% 89%"
  };
  --on-surface-variant: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-surface-variant:"))
      ?.split(": ")[1] || "258 9% 46%"
  };
  
  /* Material Design 3 Generated Colors - Error Family */
  --error: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--error:") && !line.includes("container"))
      ?.split(": ")[1] || "0 74% 50%"
  };
  --on-error: ${
    cssProps.light
      .split("\n")
      .find(
        (line) => line.includes("--on-error:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "0 0% 100%"
  };
  --error-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--error-container:"))
      ?.split(": ")[1] || "0 100% 93%"
  };
  --on-error-container: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-error-container:"))
      ?.split(": ")[1] || "0 100% 14%"
  };
  
  /* Material Design 3 Generated Colors - Additional */
  --outline: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--outline:") && !line.includes("variant"))
      ?.split(": ")[1] || "258 9% 46%"
  };
  --outline-variant: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--outline-variant:"))
      ?.split(": ")[1] || "260 7% 89%"
  };
  --background: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--background:"))
      ?.split(": ")[1] || "340 100% 99%"
  };
  --on-background: ${
    cssProps.light
      .split("\n")
      .find((line) => line.includes("--on-background:"))
      ?.split(": ")[1] || "236 13% 12%"
  };
  
  /* Map Material 3 colors to shadcn/ui system */
  --foreground: var(--on-surface);
  --muted: var(--surface-variant);
  --muted-foreground: var(--on-surface-variant);
  --card: var(--surface);
  --card-foreground: var(--on-surface);
  --popover: var(--surface);
  --popover-foreground: var(--on-surface);
  --accent: var(--secondary-container);
  --accent-foreground: var(--on-secondary-container);
  --destructive: var(--error);
  --destructive-foreground: var(--on-error);
  --border: var(--outline-variant);
  --input: var(--outline);
  --ring: var(--primary);
  
  /* Existing radius */
  --radius: 0.5rem;
}
`.trim();

const darkThemeCSS = `
/* === Pure Material Design 3 Dark Theme === */
.dark {
  /* Material Design 3 Generated Colors - Primary Family */
  --primary: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--primary:"))
      ?.split(": ")[1] || "261 100% 81%"
  };
  --on-primary: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) => line.includes("--on-primary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "262 100% 18%"
  };
  --primary-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--primary-container:"))
      ?.split(": ")[1] || "259 52% 36%"
  };
  --on-primary-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--on-primary-container:"))
      ?.split(": ")[1] || "261 100% 93%"
  };
  
  /* Material Design 3 Generated Colors - Secondary Family */
  --secondary: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) => line.includes("--secondary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "263 17% 76%"
  };
  --on-secondary: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) =>
          line.includes("--on-secondary:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "257 26% 13%"
  };
  --secondary-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--secondary-container:"))
      ?.split(": ")[1] || "258 14% 27%"
  };
  --on-secondary-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--on-secondary-container:"))
      ?.split(": ")[1] || "263 65% 92%"
  };
  
  /* Material Design 3 Generated Colors - Surface Family */
  --surface: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) =>
          line.includes("--surface:") &&
          !line.includes("variant") &&
          !line.includes("container"),
      )
      ?.split(": ")[1] || "236 13% 12%"
  };
  --on-surface: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) => line.includes("--on-surface:") && !line.includes("variant"),
      )
      ?.split(": ")[1] || "260 8% 90%"
  };
  --surface-variant: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--surface-variant:"))
      ?.split(": ")[1] || "258 9% 32%"
  };
  --on-surface-variant: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--on-surface-variant:"))
      ?.split(": ")[1] || "260 7% 68%"
  };
  
  /* Material Design 3 Generated Colors - Error Family */
  --error: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--error:") && !line.includes("container"))
      ?.split(": ")[1] || "0 100% 81%"
  };
  --on-error: ${
    cssProps.dark
      .split("\n")
      .find(
        (line) => line.includes("--on-error:") && !line.includes("container"),
      )
      ?.split(": ")[1] || "0 100% 14%"
  };
  --error-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--error-container:"))
      ?.split(": ")[1] || "0 69% 31%"
  };
  --on-error-container: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--on-error-container:"))
      ?.split(": ")[1] || "0 100% 93%"
  };
  
  /* Material Design 3 Generated Colors - Additional */
  --outline: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--outline:") && !line.includes("variant"))
      ?.split(": ")[1] || "258 9% 57%"
  };
  --outline-variant: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--outline-variant:"))
      ?.split(": ")[1] || "258 9% 32%"
  };
  --background: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--background:"))
      ?.split(": ")[1] || "236 13% 12%"
  };
  --on-background: ${
    cssProps.dark
      .split("\n")
      .find((line) => line.includes("--on-background:"))
      ?.split(": ")[1] || "260 8% 90%"
  };
  
  /* Map Material 3 colors to shadcn/ui system */
  --foreground: var(--on-surface);
  --muted: var(--surface-variant);
  --muted-foreground: var(--on-surface-variant);
  --card: var(--surface);
  --card-foreground: var(--on-surface);
  --popover: var(--surface);
  --popover-foreground: var(--on-surface);
  --accent: var(--secondary-container);
  --accent-foreground: var(--on-secondary-container);
  --destructive: var(--error);
  --destructive-foreground: var(--on-error);
  --border: var(--outline-variant);
  --input: var(--outline);
  --ring: var(--primary);
}
`.trim();

console.log("📋 Pure Material Design 3 CSS Generated:");
console.log("=====================================");
console.log(lightThemeCSS);
console.log("");
console.log(darkThemeCSS);
console.log("=====================================");
console.log("");

console.log("💡 Navigation Usage with Pure Material 3:");
console.log("1. Navigation background: bg-surface (light purple-tinted white)");
console.log("2. Navigation text: text-on-surface (high contrast dark)");
console.log("3. Primary buttons: bg-primary text-on-primary");
console.log("4. Secondary buttons: bg-secondary text-on-secondary");
console.log("5. Ghost buttons: text-on-surface hover:bg-surface-variant");
console.log(
  "6. For lighter purple: use bg-primary-container text-on-primary-container",
);
console.log("");

console.log("🎯 Recommended Navigation Classes:");
console.log("  Main nav: bg-surface border-b border-outline-variant");
console.log("  Nav text: text-on-surface");
console.log("  Active/primary: bg-primary text-on-primary");
console.log("  Hover states: hover:bg-surface-variant");
console.log(
  "  Light purple option: bg-primary-container text-on-primary-container",
);
console.log("");

console.log("✅ Pure Material Design 3 CSS generation complete!");
console.log(
  "🎨 All colors follow Material Design 3 accessibility and contrast guidelines",
);
