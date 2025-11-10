#!/bin/bash
# Check for high/critical npm vulnerabilities

echo '🔍 Checking for high/critical npm vulnerabilities...'

# Run npm audit and check for high/critical vulnerabilities
npm audit --audit-level=high --json | jq -e '
  .vulnerabilities |
  to_entries |
  map(select(.value.severity == "high" or .value.severity == "critical")) |
  length == 0
' || (echo '❌ High/critical vulnerabilities found!' && exit 1)

echo '✅ No high/critical npm vulnerabilities found'