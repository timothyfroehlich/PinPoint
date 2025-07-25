#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('npm run betterer:check', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ Betterer: No regressions');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  console.log('✗ Betterer: Regressions detected');
  
  // Show relevant lines
  const relevantLines = output.split('\n')
    .filter(line => /better|worse|errors/i.test(line))
    .slice(0, 5);
  
  relevantLines.forEach(line => console.log(line));
  process.exit(1);
}