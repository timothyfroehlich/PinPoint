#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('npm run build --silent', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ Build: Successful');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  const errorLines = output.split('\n')
    .filter(line => /Failed to compile|Syntax error|Type error/i.test(line))
    .slice(0, 25);
  
  if (errorLines.length > 0) {
    errorLines.forEach(line => console.log(line));
    process.exit(1);
  } else {
    console.log('✓ Build: Successful');
  }
}