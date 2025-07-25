#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('vitest run --silent', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ Tests: All passing');
} catch (error) {
  console.log('Vitest: Tests failed');
  process.exit(1);
}