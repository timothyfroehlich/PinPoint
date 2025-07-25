#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('eslint src/ --format compact', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ ESLint: 0 problems'); 
} catch (error) {
  const output = error.stdout || error.stderr || '';
  const lines = output.trim().split('\n').filter(line => line.trim());
  const errorCount = lines.length;
  
  if (errorCount > 0) {
    console.log(`ESLint: ${errorCount} problems`);
    lines.slice(0, 25).forEach(line => console.log(line));
    process.exit(1);
  } else {
    console.log('✓ ESLint: 0 problems');
  }
}