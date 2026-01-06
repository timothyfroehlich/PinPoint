# Dockerized E2E Testing

PinPoint uses Docker to run E2E tests in a consistent environment, specifically enabling Mobile Safari (WebKit) testing on Linux.

## Prerequisites

- Docker installed and running.

## Running Tests

Use the helper script to run tests inside the official Playwright Docker container:

```bash
./scripts/test-e2e-docker.sh
```

### Passing Arguments

You can pass standard Playwright arguments to the script:

```bash
# Run a specific file
./scripts/test-e2e-docker.sh e2e/smoke/public-reporting.spec.ts

# debug mode
./scripts/test-e2e-docker.sh --debug
```

## How It Works

1.  **Image**: Uses `mcr.microsoft.com/playwright:v1.57.0-jammy` (matches `package.json` version).
2.  **Network**: Uses `--network host` to access your locally running dev server (`localhost:3000`) and Supabase instance (`localhost:54321`).
3.  **Dependencies**: Runs `npm ci` inside the container to ensure binary compatibility with the container's Linux environment (Ubuntu 22.04).

> [!WARNING]
> Running this script will update your `node_modules` to match the container's environment (Ubuntu 22.04). If you are running on a different OS (e.g., Ubuntu 25.10 or macOS), you may need to run `npm ci` again on your host machine afterwards to restore binary compatibility for local commands.
