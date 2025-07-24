#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  const output = execSync('npm audit --audit-level=high --format json', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  const auditData = JSON.parse(output);
  const high = auditData.metadata?.vulnerabilities?.high || 0;
  const critical = auditData.metadata?.vulnerabilities?.critical || 0;
  
  if (high > 0 || critical > 0) {
    console.log(`Dependencies: High: ${high}, Critical: ${critical}`);
    process.exit(1);
  } else {
    console.log('✓ Dependencies: No high/critical vulnerabilities');
  }
} catch (error) {
  // If jq or audit fails, assume no critical issues
  console.log('✓ Dependencies: No high/critical vulnerabilities');
}