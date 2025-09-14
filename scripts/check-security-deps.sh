#!/bin/bash
# Check that required security tools are installed

echo '🔧 Checking security dependencies...'

# Check for gitleaks
if ! which gitleaks > /dev/null; then
  echo '❌ Gitleaks not installed! Install with: brew install gitleaks'
  exit 1
fi

# Check for trufflehog
if ! which trufflehog > /dev/null; then
  echo '❌ TruffleHog not installed! Install with: brew install trufflesecurity/trufflehog/trufflehog'
  exit 1
fi

# Check for jq
if ! which jq > /dev/null; then
  echo '❌ jq not installed! Install with: brew install jq'
  exit 1
fi

echo '✅ All security dependencies installed'