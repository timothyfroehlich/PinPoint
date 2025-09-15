#!/bin/bash
# Check for large files in staged commits

# Get staged files and check their size
git diff --cached --name-only | while read -r file; do
  if [ -f "$file" ]; then
    # Get file size in bytes
    size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    if [ -z "$size" ]; then
      echo "⚠️  Warning: Could not determine size of '$file'. Assuming 0 bytes." >&2
      size=0
    fi
    # Check if file is larger than 1MB (1048576 bytes)
    if [ "$size" -gt 1048576 ]; then
      echo "❌ Large file detected: $file ($((size / 1024))KB > 1MB)"
      exit 1
    fi
  fi
done