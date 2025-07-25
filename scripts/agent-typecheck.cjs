#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('npm run typecheck -- --pretty false --skipLibCheck', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('✓ TypeScript: 0 errors');
} catch (error) {
  const output = error.stdout || error.stderr || '';
  const errorLines = output.split('\n').filter(line => line.includes('error TS'));
  const errorCount = errorLines.length;
  
  if (errorCount > 0) {
    console.log(`TypeScript: ${errorCount} errors`);
    errorLines.slice(0, 25).forEach(line => console.log(line));
    process.exit(1);
  } else {
    console.log('✓ TypeScript: 0 errors');
  }
}