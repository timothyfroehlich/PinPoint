#!/bin/bash

# Script to run Playwright E2E tests inside a Docker container
# Useful for running Safari/Webkit tests on Linux

IMAGE_NAME="mcr.microsoft.com/playwright:v1.57.0-jammy"

echo "🐳 Starting Playwright Docker Container..."
echo "Using image: $IMAGE_NAME"

# Check if image exists, pull if not
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  echo "Image not found. Pulling..."
  docker pull $IMAGE_NAME
fi

echo "🧹 Resetting database on host..."
npm run db:fast-reset

echo "🚀 Running tests..."
# --network host: Access the host's localhost:3000
# --ipc=host: Prevent Chrome crashing
# -v $(pwd):/work/: Map current directory
# npm ci: Ensure dependencies match the container OS
docker run --rm \
  --network host \
  --ipc=host \
  -e PLAYWRIGHT_SKIP_SAFARI=0 \
  -e SKIP_SUPABASE_RESET=true \
  -v "$(pwd):/work/" \
  -w /work/ \
  -it $IMAGE_NAME \
  /bin/bash -c "npm ci && npx playwright test --project='Mobile Safari' $@"
