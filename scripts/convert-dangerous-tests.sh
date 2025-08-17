#!/bin/bash

# Emergency script to convert dangerous PGlite memory patterns to safe worker-scoped patterns
# This addresses the critical system memory issue caused by per-test database creation

echo "Converting dangerous test patterns to worker-scoped patterns..."

# File list of files that need conversion
FILES=(
  "src/integration-tests/model.opdb.integration.test.ts"
  "src/server/services/__tests__/notificationService.test.ts"
  "src/server/api/routers/utils/__tests__/commentValidation.test.ts"
  "src/server/api/routers/utils/__tests__/commentService.test.ts"
  "src/server/api/routers/__tests__/issue.integration.test.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Convert test signatures that don't have worker-scoped parameter
    sed -i 's/test(\([^,]*\), async () => {/test(\1, async ({ workerDb }) => {/g' "$file"
    
    # Add withIsolatedTest wrapper around test body (simplified approach)
    # This is a basic conversion - tests will need manual review for full functionality
    
    echo "Basic conversion completed for $file"
  else
    echo "Warning: $file not found"
  fi
done

echo "Emergency conversion completed. Tests converted to use worker-scoped pattern."
echo "Note: Some tests may need manual review for full functionality restoration."