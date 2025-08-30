#!/usr/bin/env tsx
/**
 * Debug Material Design 3 colors to see actual computed values
 * Run with: npx tsx scripts/debug-colors.ts
 */

import { 
  generateMaterialTheme, 
  PINPOINT_PURPLE_SOURCE 
} from '../src/lib/colors/material-theme-generator.js';

console.log('🔍 Debugging Material Design 3 Colors\n');

// Generate theme
const theme = generateMaterialTheme(PINPOINT_PURPLE_SOURCE);

// Function to convert HSL string back to hex for visualization
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Parse our CSS HSL values
function parseHslString(hslStr: string): {h: number, s: number, l: number} {
  const parts = hslStr.split(' ');
  const h = parseInt(parts[0]);
  const s = parseInt(parts[1].replace('%', ''));
  const l = parseInt(parts[2].replace('%', ''));
  return { h, s, l };
}

console.log('📊 Key Material 3 Colors Analysis:');
console.log('=====================================');

console.log(`🎨 Source Purple: ${PINPOINT_PURPLE_SOURCE}`);
console.log('');

// Check light theme surface colors
console.log('🌅 Light Theme Surface Colors:');
const lightSurface = parseHslString('300 100% 99%'); // Our surface color
const lightSurfaceHex = hslToHex(lightSurface.h, lightSurface.s, lightSurface.l);
console.log(`  Surface (bg-background): hsl(300 100% 99%) = ${lightSurfaceHex}`);

const lightPrimaryContainer = parseHslString('261 100% 93%'); // Our primary-container
const lightPrimaryContainerHex = hslToHex(lightPrimaryContainer.h, lightPrimaryContainer.s, lightPrimaryContainer.l);
console.log(`  Primary Container (navigation): hsl(261 100% 93%) = ${lightPrimaryContainerHex}`);

const lightPrimary = parseHslString('256 34% 48%'); // Our primary
const lightPrimaryHex = hslToHex(lightPrimary.h, lightPrimary.s, lightPrimary.l);
console.log(`  Primary (buttons): hsl(256 34% 48%) = ${lightPrimaryHex}`);

console.log('');

// Analyze if colors are too close to white
const whiteHex = '#ffffff';
console.log('🔍 Color Analysis:');
console.log(`  Pure White: ${whiteHex}`);
console.log(`  Our Surface: ${lightSurfaceHex} ${lightSurfaceHex === '#ffffff' ? '❌ IDENTICAL TO WHITE!' : lightSurfaceHex.toLowerCase() === '#fefffe' || lightSurfaceHex.toLowerCase() === '#fffeff' ? '⚠️  VERY CLOSE TO WHITE' : '✅ Distinguishable from white'}`);
console.log(`  Our Nav Background: ${lightPrimaryContainerHex} ${lightPrimaryContainerHex.toLowerCase().startsWith('#f') ? '⚠️  Very light' : '✅ Good contrast'}`);

console.log('');

console.log('💡 Diagnosis:');
if (lightSurfaceHex === '#ffffff' || lightSurfaceHex.toLowerCase() === '#fefffe' || lightSurfaceHex.toLowerCase() === '#fffeff') {
  console.log('❌ PROBLEM: Surface color is essentially white!');
  console.log('   Solution: Use a darker surface or different Material 3 variant');
} else {
  console.log('✅ Surface color is distinguishable from white');
  console.log('   Issue might be elsewhere (Material UI overrides, component-level whites)');
}

console.log('');
console.log('🎯 Recommendations:');
console.log('1. Try using secondary-container for main backgrounds (more purple)');
console.log('2. Check for Material UI theme overrides');
console.log('3. Look for hardcoded bg-white classes in components');
console.log('4. Verify CSS custom properties are loading correctly');

console.log('');
console.log('🧪 Alternative Surface Colors:');
console.log(`  Secondary Container: hsl(263 65% 92%) = ${hslToHex(263, 65, 92)}`);
console.log(`  Tertiary Container: hsl(344 100% 93%) = ${hslToHex(344, 100, 93)}`);
console.log(`  Surface Variant: hsl(278 22% 90%) = ${hslToHex(278, 22, 90)}`);