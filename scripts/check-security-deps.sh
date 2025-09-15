#!/bin/bash
# Check that required security tools are installed

echo '🔧 Checking security dependencies...'

# Function to show installation instructions based on OS
show_install_instructions() {
  local tool="$1"
  local brew_cmd="$2"
  local apt_cmd="$3"

  echo "❌ $tool not installed!"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   Install with: $brew_cmd"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   Install with: $apt_cmd"
    echo "   Or visit the project's GitHub releases page for manual installation"
  else
    echo "   Visit the project's GitHub releases page for installation instructions"
  fi
}

# Check for gitleaks
if ! which gitleaks > /dev/null; then
  show_install_instructions "Gitleaks" "brew install gitleaks" "apt install gitleaks"
  exit 1
fi

# Check for trufflehog
if ! which trufflehog > /dev/null; then
  show_install_instructions "TruffleHog" "brew install trufflesecurity/trufflehog/trufflehog" "apt install trufflehog"
  exit 1
fi

# Check for jq
if ! which jq > /dev/null; then
  show_install_instructions "jq" "brew install jq" "apt install jq"
  exit 1
fi

echo '✅ All security dependencies installed'