#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('actionlint .github/workflows/*.yml', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ Workflows: Valid');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  const lines = output.trim().split('\n').slice(0, 25);
  
  if (lines.length > 0 && lines[0].trim()) {
    lines.forEach(line => console.log(line));
    process.exit(1);
  } else {
    console.log('✓ Workflows: Valid');
  }
}