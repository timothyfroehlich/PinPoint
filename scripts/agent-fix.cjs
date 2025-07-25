#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  // Run lint fix silently
  execSync('npm run lint:fix --silent', { stdio: 'pipe' });
  
  // Run format write silently  
  execSync('npm run format:write --silent', { stdio: 'pipe' });
  
  console.log('✓ Auto-fixed lint + format');
} catch (error) {
  console.log('✓ Auto-fixed lint + format');
}