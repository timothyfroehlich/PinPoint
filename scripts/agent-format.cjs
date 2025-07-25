#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('prettier --check "**/*.{ts,tsx,js,jsx,mdx}" --cache', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ Prettier: All formatted');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  const needsFormatting = output.includes('Code style issues') || output.includes('would be re-written');
  
  if (needsFormatting) {
    // Count files that need formatting
    const lines = output.split('\n').filter(line => line.trim() && !line.includes('Checking formatting'));
    console.log(`Prettier: ${lines.length} files need formatting`);
    process.exit(1);
  } else {
    console.log('✓ Prettier: All formatted');
  }
}