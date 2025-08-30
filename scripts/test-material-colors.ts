#!/usr/bin/env tsx
/**
 * Test script for Material Design 3 color generation
 * Run with: npx tsx scripts/test-material-colors.ts
 */

import { 
  generateMaterialTheme, 
  generateCssCustomProperties, 
  PINPOINT_PURPLE_SOURCE 
} from '../src/lib/colors/material-theme-generator.js';

console.log('🎨 Testing Material Design 3 Color Generation for PinPoint\n');

console.log(`📍 Source Color: ${PINPOINT_PURPLE_SOURCE}\n`);

// Generate the theme
const theme = generateMaterialTheme(PINPOINT_PURPLE_SOURCE);

console.log('🌅 Light Theme Colors:');
console.log(`  Surface (navigation background): ${theme.light.surface}`);
console.log(`  On Surface (text on navigation): ${theme.light.onSurface}`);
console.log(`  Surface Container Low (light purple): ${theme.light.surfaceContainerLow}`);
console.log(`  Surface Container (medium purple): ${theme.light.surfaceContainer}`);
console.log(`  Primary: ${theme.light.primary}`);
console.log(`  On Primary: ${theme.light.onPrimary}`);
console.log(`  Secondary: ${theme.light.secondary}`);
console.log(`  Tertiary: ${theme.light.tertiary}`);
console.log('');

console.log('🌙 Dark Theme Colors:');
console.log(`  Surface: ${theme.dark.surface}`);
console.log(`  On Surface: ${theme.dark.onSurface}`);
console.log(`  Surface Container Low: ${theme.dark.surfaceContainerLow}`);
console.log(`  Surface Container: ${theme.dark.surfaceContainer}`);
console.log(`  Primary: ${theme.dark.primary}`);
console.log(`  Secondary: ${theme.dark.secondary}`);
console.log('');

// Generate CSS custom properties
const cssProps = generateCssCustomProperties(theme);

console.log('📋 CSS Custom Properties Preview (Light Theme):');
console.log(cssProps.light.split('\n').slice(0, 10).join('\n'));
console.log('  ...\n');

console.log('🎯 Key Colors for Navigation:');
console.log(`  Light Background: ${theme.light.surfaceContainerLow} (soft purple)`);
console.log(`  Light Text: ${theme.light.onSurface} (high contrast)`);
console.log(`  Button Primary: ${theme.light.primary}`);
console.log(`  Button Text: ${theme.light.onPrimary}`);
console.log('');

console.log('✅ Color generation successful!');
console.log('💡 Ready to update globals.css with these colors.');